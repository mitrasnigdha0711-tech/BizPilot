import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

const HORIZONS = [30, 60, 90];
const DAY_MS = 24 * 60 * 60 * 1000;
const OWNER_ROLE = 'SMALL_VIDEO_EDITING_BUSINESS_OWNER';
const OPEN_INVOICE_STATUSES: string[] = ['SENT', 'PARTIALLY_PAID', 'OVERDUE'];

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = Number(String(value));
  return Number.isFinite(n) ? n : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveToday(request: NextRequest): string {
  const param = request.nextUrl.searchParams.get('date');
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) return param;
  return new Date().toLocaleDateString('en-CA');
}

function nextOccurrence(current: Date, frequency: string): Date {
  const d = new Date(current);
  switch (frequency) {
    case 'WEEKLY':
      d.setUTCDate(d.getUTCDate() + 7);
      return d;
    case 'QUARTERLY':
      d.setUTCMonth(d.getUTCMonth() + 3);
      return d;
    case 'YEARLY':
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      return d;
    case 'MONTHLY':
    default:
      d.setUTCMonth(d.getUTCMonth() + 1);
      return d;
  }
}

function billOutflowInWindow(
  bill: { amount: unknown; frequency: string; nextDueDate: Date; endDate: Date | null },
  start: Date,
  end: Date,
): number {
  let cur = new Date(bill.nextDueDate);
  const stop = bill.endDate ? new Date(bill.endDate) : null;
  let guard = 0;

  while (cur < start && guard < 1000) {
    cur = nextOccurrence(cur, bill.frequency);
    guard++;
  }

  let total = 0;
  while (cur < end && guard < 2000) {
    if (stop && cur > stop) break;
    total += toNumber(bill.amount);
    cur = nextOccurrence(cur, bill.frequency);
    guard++;
  }
  return total;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (user instanceof Response) return user;

    const owner = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, businessId: true },
    });
    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (owner.role !== OWNER_ROLE) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!owner.businessId) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    const businessId = owner.businessId;

    const day = resolveToday(request);
    const today = new Date(`${day}T00:00:00Z`);

    const invoices = await prisma.invoice.findMany({
      where: { businessId },
      select: { id: true, dueDate: true, balanceDue: true, status: true },
    });
    const invoiceIds = invoices.map((inv) => inv.id);

    const payments = invoiceIds.length
      ? await prisma.payment.findMany({
          where: { invoiceId: { in: invoiceIds } },
          select: { invoiceId: true, amount: true, status: true, expectedDate: true },
        })
      : [];

    const expenses = await prisma.expens.findMany({
      where: { businessId },
      select: { amount: true },
    });

    const bills = await prisma.recurringBill.findMany({
      where: { businessId, status: 'ACTIVE' },
      select: { amount: true, frequency: true, nextDueDate: true, endDate: true },
    });

    // Scheduled (not yet received) payments per invoice, used so an invoice's
    // balance is not counted twice when a payment for it is already expected.
    const expectedByInvoice = new Map<string, number>();
    let receivedTotal = 0;
    for (const p of payments) {
      if (p.status === 'EXPECTED') {
        expectedByInvoice.set(
          p.invoiceId,
          (expectedByInvoice.get(p.invoiceId) ?? 0) + toNumber(p.amount),
        );
      } else if (p.status === 'RECEIVED') {
        receivedTotal += toNumber(p.amount);
      }
    }

    const expensesTotal = expenses.reduce((sum, e) => sum + toNumber(e.amount), 0);
    const baselineBalance = round2(receivedTotal - expensesTotal);

    const openInvoices = invoices.filter(
      (inv) => OPEN_INVOICE_STATUSES.includes(inv.status) && toNumber(inv.balanceDue) > 0,
    );

    const rows = HORIZONS.map((horizonDays) => {
      const start = today;
      const end = new Date(today.getTime() + horizonDays * DAY_MS);

      let inflow = 0;
      for (const inv of openInvoices) {
        const due = new Date(inv.dueDate);
        if (due >= start && due < end) {
          const scheduled = expectedByInvoice.get(inv.id) ?? 0;
          inflow += Math.max(0, toNumber(inv.balanceDue) - scheduled);
        }
      }

      for (const p of payments) {
        if (p.status !== 'EXPECTED' || !p.expectedDate) continue;
        const expected = new Date(p.expectedDate);
        if (expected >= start && expected < end) {
          inflow += toNumber(p.amount);
        }
      }

      let outflow = 0;
      for (const bill of bills) {
        outflow += billOutflowInWindow(bill, start, end);
      }

      const net = inflow - outflow;
      const projectedBalance = baselineBalance + net;
      const shortfall = Math.max(0, -projectedBalance);

      return {
        horizonDays,
        projectedInflow: round2(inflow),
        projectedOutflow: round2(outflow),
        netCashflow: round2(net),
        baselineBalance,
        projectedBalance: round2(projectedBalance),
        shortfallAmount: round2(shortfall),
        generatedAt: new Date(),
        businessId,
        userId: user.id,
      };
    });

    const cashflowForecasts = await prisma.$transaction(
      rows.map((data) => prisma.cashflowForecast.create({ data })),
    );

    return NextResponse.json({ cashflowForecasts });
  } catch (error) {
    console.error('Failed to generate business cashflow forecasts', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}