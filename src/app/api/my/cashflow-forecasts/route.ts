import { NextResponse } from 'next/server';
import {
  Prisma,
  Role,
  InvoiceStatus,
  PaymentStatus,
  RecurringBillStatus,
  RecurringFrequency,
} from '@prisma/client';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const HORIZONS = [30, 60, 90] as const;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_HORIZON = 90;

type Caller = { id: string; businessId: string | null };

async function loadEditor(request: Request): Promise<Caller | Response> {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, role: true, businessId: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (dbUser.role !== Role.FREELANCE_VIDEO_EDITOR) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return { id: dbUser.id, businessId: dbUser.businessId };
}

/** Returns the requested calendar day as YYYY-MM-DD, the server's local day when absent, or null when malformed. */
function resolveDay(request: Request): string | null {
  const raw = new URL(request.url).searchParams.get('date');
  if (raw === null) return new Date().toLocaleDateString('en-CA');
  if (!DAY_RE.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) return null;
  return raw;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + n);
  return x;
}

function stepFrequency(d: Date, frequency: RecurringFrequency): Date {
  switch (frequency) {
    case RecurringFrequency.WEEKLY:
      return addDays(d, 7);
    case RecurringFrequency.MONTHLY:
      return addMonths(d, 1);
    case RecurringFrequency.QUARTERLY:
      return addMonths(d, 3);
    case RecurringFrequency.YEARLY:
      return addMonths(d, 12);
    default:
      return addMonths(d, 1);
  }
}

/** Occurrences of a recurring schedule falling within [from, to]. */
function occurrencesInWindow(
  nextDueDate: Date,
  frequency: RecurringFrequency,
  endDate: Date | null,
  from: Date,
  to: Date,
): Date[] {
  const out: Date[] = [];
  let cursor = new Date(nextDueDate);
  let guard = 0;
  while (cursor < from && guard++ < 2000) {
    cursor = stepFrequency(cursor, frequency);
  }
  while (cursor <= to && guard++ < 4000) {
    if (endDate && cursor > endDate) break;
    out.push(cursor);
    cursor = stepFrequency(cursor, frequency);
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type Inputs = {
  invoices: { id: string; dueDate: Date; balanceDue: number }[];
  payments: { invoiceId: string; amount: number; expectedDate: Date }[];
  bills: { amount: number; frequency: RecurringFrequency; nextDueDate: Date; endDate: Date | null }[];
  baseline: number;
};

async function loadInputs(userId: string, dayStart: Date, maxEnd: Date): Promise<Inputs> {
  const [invoiceRows, paymentRows, billRows, receivedAgg, expenseAgg] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        userId,
        balanceDue: { gt: 0 },
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
        dueDate: { gte: dayStart, lte: maxEnd },
      },
      select: { id: true, dueDate: true, balanceDue: true },
    }),
    prisma.payment.findMany({
      where: {
        userId,
        status: PaymentStatus.EXPECTED,
        expectedDate: { gte: dayStart, lte: maxEnd },
      },
      select: { invoiceId: true, amount: true, expectedDate: true },
    }),
    prisma.recurringBill.findMany({
      where: { userId, status: RecurringBillStatus.ACTIVE },
      select: { amount: true, frequency: true, nextDueDate: true, endDate: true },
    }),
    prisma.payment.aggregate({
      where: { userId, status: PaymentStatus.RECEIVED },
      _sum: { amount: true },
    }),
    prisma.expens.aggregate({
      where: { userId },
      _sum: { amount: true },
    }),
  ]);

  const received = receivedAgg._sum.amount?.toNumber() ?? 0;
  const expenses = expenseAgg._sum.amount?.toNumber() ?? 0;

  return {
    invoices: invoiceRows.map((i) => ({
      id: i.id,
      dueDate: i.dueDate,
      balanceDue: i.balanceDue.toNumber(),
    })),
    payments: paymentRows
      .filter((p): p is typeof p & { expectedDate: Date } => p.expectedDate !== null)
      .map((p) => ({
        invoiceId: p.invoiceId,
        amount: p.amount.toNumber(),
        expectedDate: p.expectedDate,
      })),
    bills: billRows.map((b) => ({
      amount: b.amount.toNumber(),
      frequency: b.frequency,
      nextDueDate: b.nextDueDate,
      endDate: b.endDate,
    })),
    baseline: round2(received - expenses),
  };
}

type ForecastValues = {
  horizonDays: number;
  projectedInflow: number;
  projectedOutflow: number;
  netCashflow: number;
  baselineBalance: number;
  projectedBalance: number;
  shortfallAmount: number;
};

function buildForecast(inputs: Inputs, horizonDays: number, dayStart: Date): ForecastValues {
  const end = addDays(dayStart, horizonDays);
  const inWindow = (d: Date) => d >= dayStart && d <= end;

  // Unpaid/partially paid invoice balances count on their due date inside the horizon.
  let inflow = 0;
  const invoiceIdsInWindow = new Set<string>();
  for (const inv of inputs.invoices) {
    if (inWindow(inv.dueDate)) {
      inflow += inv.balanceDue;
      invoiceIdsInWindow.add(inv.id);
    }
  }

  // Expected payments dated in the horizon add to inflow, except those already
  // counted through their invoice's balance (avoids double counting).
  for (const p of inputs.payments) {
    if (inWindow(p.expectedDate) && !invoiceIdsInWindow.has(p.invoiceId)) {
      inflow += p.amount;
    }
  }

  // Active recurring bills count as outflow on each occurrence inside the horizon.
  let outflow = 0;
  for (const bill of inputs.bills) {
    const occurrences = occurrencesInWindow(
      bill.nextDueDate,
      bill.frequency,
      bill.endDate,
      dayStart,
      end,
    );
    outflow += occurrences.length * bill.amount;
  }

  const inflowR = round2(inflow);
  const outflowR = round2(outflow);
  const net = round2(inflowR - outflowR);
  const baseline = inputs.baseline;
  const projected = round2(baseline + net);
  const shortfall = round2(Math.max(0, -projected));

  return {
    horizonDays,
    projectedInflow: inflowR,
    projectedOutflow: outflowR,
    netCashflow: net,
    baselineBalance: baseline,
    projectedBalance: projected,
    shortfallAmount: shortfall,
  };
}

type ForecastRow = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  horizonDays: number;
  projectedInflow: Prisma.Decimal;
  projectedOutflow: Prisma.Decimal;
  netCashflow: Prisma.Decimal;
  baselineBalance: Prisma.Decimal | null;
  projectedBalance: Prisma.Decimal | null;
  shortfallAmount: Prisma.Decimal;
  generatedAt: Date;
  businessId: string;
  userId: string;
};

function toDto(f: ForecastRow) {
  return {
    id: f.id,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
    horizonDays: f.horizonDays,
    projectedInflow: f.projectedInflow.toNumber(),
    projectedOutflow: f.projectedOutflow.toNumber(),
    netCashflow: f.netCashflow.toNumber(),
    baselineBalance: f.baselineBalance?.toNumber() ?? null,
    projectedBalance: f.projectedBalance?.toNumber() ?? null,
    shortfallAmount: f.shortfallAmount.toNumber(),
    generatedAt: f.generatedAt.toISOString(),
    businessId: f.businessId,
    userId: f.userId,
  };
}

export async function GET(request: Request) {
  try {
    const caller = await loadEditor(request);
    if (caller instanceof Response) return caller;

    const rows = await Promise.all(
      HORIZONS.map((h) =>
        prisma.cashflowForecast.findFirst({
          where: { userId: caller.id, horizonDays: h },
          orderBy: { generatedAt: 'desc' },
        }),
      ),
    );

    const cashflowForecasts = rows
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map(toDto);

    return NextResponse.json({ cashflowForecasts });
  } catch (e) {
    console.error('GET /api/my/cashflow-forecasts failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const caller = await loadEditor(request);
    if (caller instanceof Response) return caller;

    if (!caller.businessId) {
      return NextResponse.json({ error: 'Business setup is required' }, { status: 400 });
    }

    const day = resolveDay(request);
    if (!day) {
      return NextResponse.json({ error: 'Invalid date, expected YYYY-MM-DD' }, { status: 400 });
    }

    const dayStart = new Date(`${day}T00:00:00Z`);
    const maxEnd = addDays(dayStart, MAX_HORIZON);

    const inputs = await loadInputs(caller.id, dayStart, maxEnd);
    const generatedAt = new Date();

    const values = HORIZONS.map((h) => buildForecast(inputs, h, dayStart));

    const created = await prisma.$transaction(
      values.map((v) =>
        prisma.cashflowForecast.create({
          data: {
            horizonDays: v.horizonDays,
            projectedInflow: v.projectedInflow,
            projectedOutflow: v.projectedOutflow,
            netCashflow: v.netCashflow,
            baselineBalance: v.baselineBalance,
            projectedBalance: v.projectedBalance,
            shortfallAmount: v.shortfallAmount,
            generatedAt,
            businessId: caller.businessId as string,
            userId: caller.id,
          },
        }),
      ),
    );

    return NextResponse.json({ cashflowForecasts: created.map(toDto) }, { status: 201 });
  } catch (e) {
    console.error('POST /api/my/cashflow-forecasts failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}