import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const HORIZONS = [30, 60, 90] as const;
const OWNER_ROLE = 'small_video_editing_business_owner';

type OwnerContext = { userId: string; businessId: string };

function num(v: unknown): number {
  const n = Number(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysUTC(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000);
}

function addMonthsUTC(d: Date, months: number): Date {
  const r = new Date(d.getTime());
  r.setUTCMonth(r.getUTCMonth() + months);
  return r;
}

function toWire(f: {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  horizonDays: number;
  projectedInflow: unknown;
  projectedOutflow: unknown;
  netCashflow: unknown;
  baselineBalance: unknown;
  projectedBalance: unknown;
  shortfallAmount: unknown;
  generatedAt: Date;
  businessId: string;
  userId: string;
}) {
  return {
    id: f.id,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    horizonDays: f.horizonDays,
    projectedInflow: round2(num(f.projectedInflow)),
    projectedOutflow: round2(num(f.projectedOutflow)),
    netCashflow: round2(num(f.netCashflow)),
    baselineBalance: f.baselineBalance === null ? null : round2(num(f.baselineBalance)),
    projectedBalance: f.projectedBalance === null ? null : round2(num(f.projectedBalance)),
    shortfallAmount: round2(num(f.shortfallAmount)),
    generatedAt: f.generatedAt,
    businessId: f.businessId,
    userId: f.userId,
  };
}

async function loadOwner(request: NextRequest): Promise<OwnerContext | Response> {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, businessId: true, isActive: true },
  });

  if (!dbUser || !dbUser.isActive) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  // Role is stored as an enum; compare its normalized form to the role value.
  if (String(dbUser.role).toLowerCase() !== OWNER_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!dbUser.businessId) {
    return NextResponse.json({ error: 'Business setup is required' }, { status: 409 });
  }
  return { userId: user.id, businessId: dbUser.businessId };
}

function resolveDay(request: NextRequest): string | null {
  const raw = request.nextUrl.searchParams.get('date');
  if (raw === null) {
    return new Date().toLocaleDateString('en-CA');
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

async function computeForecasts(businessId: string, userId: string, todayStr: string) {
  const today = new Date(`${todayStr}T00:00:00Z`);

  const invoices = await prisma.invoice.findMany({
    where: { businessId },
    select: { id: true, dueDate: true, balanceDue: true },
  });
  const invoiceIds = invoices.map((i) => i.id);

  const payments = invoiceIds.length
    ? await prisma.payment.findMany({
        where: { invoiceId: { in: invoiceIds } },
        select: { invoiceId: true, amount: true, expectedDate: true, receivedAt: true },
      })
    : [];

  const expenses = await prisma.expens.findMany({
    where: { businessId, expenseDate: { lte: today } },
    select: { amount: true },
  });

  // NOTE: frequency is not in the Prisma field list, so occurrences step monthly.
  const bills = await prisma.recurringBill.findMany({
    where: { businessId },
    select: { amount: true, nextDueDate: true, endDate: true },
  });

  // Baseline = received payments minus expenses to date (never before the record existed).
  const receivedTotal = payments
    .filter((p) => p.receivedAt !== null)
    .reduce((sum, p) => sum + num(p.amount), 0);
  const expenseTotal = expenses.reduce((sum, e) => sum + num(e.amount), 0);
  const baselineBalance = receivedTotal - expenseTotal;

  // Expected (not yet received) payments grouped by invoice.
  const expectedByInvoice = new Map<string, typeof payments>();
  for (const p of payments) {
    if (p.receivedAt !== null) continue;
    const list = expectedByInvoice.get(p.invoiceId) ?? [];
    list.push(p);
    expectedByInvoice.set(p.invoiceId, list);
  }

  const unpaid = invoices.filter((i) => num(i.balanceDue) > 0);

  return HORIZONS.map((horizonDays) => {
    const endStr = ymd(addDaysUTC(today, horizonDays));
    const inWindow = (k: string) => k >= todayStr && k <= endStr;

    // Inflow: each unpaid balance lands on its due date; expected payments land on
    // their expected date. The balance not covered by expected payments lands on due date.
    let inflow = 0;
    for (const inv of unpaid) {
      const balance = num(inv.balanceDue);
      const pays = expectedByInvoice.get(inv.id) ?? [];
      const pmtTotal = pays.reduce((sum, p) => sum + num(p.amount), 0);
      for (const p of pays) {
        const d = ymd(p.expectedDate ?? inv.dueDate);
        if (inWindow(d)) inflow += num(p.amount);
      }
      const remainder = Math.max(0, balance - pmtTotal);
      if (inWindow(ymd(inv.dueDate))) inflow += remainder;
    }

    // Outflow: every occurrence of each recurring bill inside the horizon.
    let outflow = 0;
    for (const bill of bills) {
      const amt = num(bill.amount);
      const endLimit = bill.endDate ? ymd(bill.endDate) : null;
      let cur = new Date(bill.nextDueDate.getTime());
      for (let guard = 0; guard < 500; guard++) {
        const k = ymd(cur);
        if (k > endStr) break;
        if (endLimit && k > endLimit) break;
        if (k >= todayStr) outflow += amt;
        cur = addMonthsUTC(cur, 1);
      }
    }

    const net = inflow - outflow;
    const projectedBalance = baselineBalance + net;
    const shortfall = Math.max(0, -projectedBalance);

    return {
      horizonDays,
      projectedInflow: round2(inflow),
      projectedOutflow: round2(outflow),
      netCashflow: round2(net),
      baselineBalance: round2(baselineBalance),
      projectedBalance: round2(projectedBalance),
      shortfallAmount: round2(shortfall),
      generatedAt: new Date(),
      businessId,
      userId,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await loadOwner(request);
    if (ctx instanceof Response) return ctx;

    const latest = await Promise.all(
      HORIZONS.map((h) =>
        prisma.cashflowForecast.findFirst({
          where: { businessId: ctx.businessId, horizonDays: h },
          orderBy: { generatedAt: 'desc' },
        }),
      ),
    );

    const cashflowForecasts = latest
      .filter((f): f is NonNullable<typeof f> => f !== null)
      .map(toWire);

    return NextResponse.json({ cashflowForecasts });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await loadOwner(request);
    if (ctx instanceof Response) return ctx;

    const todayStr = resolveDay(request);
    if (todayStr === null) {
      return NextResponse.json({ error: 'Invalid date, expected YYYY-MM-DD' }, { status: 400 });
    }

    const rows = await computeForecasts(ctx.businessId, ctx.userId, todayStr);

    const created = await prisma.$transaction(
      rows.map((row) => prisma.cashflowForecast.create({ data: row })),
    );

    return NextResponse.json({ cashflowForecasts: created.map(toWire) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}