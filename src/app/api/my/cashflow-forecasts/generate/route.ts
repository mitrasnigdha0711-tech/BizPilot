import { NextRequest, NextResponse } from 'next/server';
import {
  Role,
  InvoiceStatus,
  RecurringBillStatus,
  RecurringFrequency,
} from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const HORIZONS = [30, 60, 90] as const;
const DAY_MS = 86_400_000;
const MAX_HORIZON_DAYS = 90;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OPEN_INVOICE_STATUSES = [
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

type DecimalLike = { toNumber(): number } | null | undefined;

const num = (v: DecimalLike): number => (v ? v.toNumber() : 0);
const round2 = (n: number): number => Math.round(n * 100) / 100;

function advance(d: Date, frequency: RecurringFrequency): Date {
  const next = new Date(d.getTime());
  switch (frequency) {
    case RecurringFrequency.WEEKLY:
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case RecurringFrequency.QUARTERLY:
      next.setUTCMonth(next.getUTCMonth() + 3);
      break;
    case RecurringFrequency.YEARLY:
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      break;
    default:
      next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

/** Sum of every occurrence of a bill whose due date falls in [start, end). */
function billOutflow(
  bill: {
    amount: DecimalLike;
    nextDueDate: Date;
    endDate: Date | null;
    frequency: RecurringFrequency;
  },
  start: Date,
  end: Date,
): number {
  let d = bill.nextDueDate;
  let guard = 0;
  while (d.getTime() < start.getTime() && guard++ < 1000) {
    d = advance(d, bill.frequency);
  }
  let total = 0;
  guard = 0;
  while (d.getTime() < end.getTime() && guard++ < 1000) {
    if (bill.endDate && d.getTime() > bill.endDate.getTime()) break;
    total += num(bill.amount);
    d = advance(d, bill.frequency);
  }
  return total;
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (dbUser.role !== Role.FREELANCE_VIDEO_EDITOR) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!dbUser.businessId) {
      return NextResponse.json(
        { error: 'Business setup required' },
        { status: 400 },
      );
    }
    const businessId = dbUser.businessId;

    const dayParam = request.nextUrl.searchParams.get('date');
    const day =
      dayParam && DATE_RE.test(dayParam)
        ? dayParam
        : new Date().toLocaleDateString('en-CA');
    const start = new Date(`${day}T00:00:00Z`);
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }
    const maxEnd = new Date(start.getTime() + MAX_HORIZON_DAYS * DAY_MS);

    const [invoices, expectedPayments, bills, receivedAgg, expenseAgg] =
      await Promise.all([
        prisma.invoice.findMany({
          where: {
            userId: user.id,
            status: { in: OPEN_INVOICE_STATUSES },
            balanceDue: { gt: 0 },
            dueDate: { gte: start, lt: maxEnd },
          },
          select: { balanceDue: true, dueDate: true },
        }),
        prisma.payment.findMany({
          where: {
            userId: user.id,
            receivedAt: null,
            expectedDate: { gte: start, lt: maxEnd },
          },
          select: { amount: true, expectedDate: true },
        }),
        prisma.recurringBill.findMany({
          where: {
            userId: user.id,
            status: RecurringBillStatus.ACTIVE,
            nextDueDate: { lt: maxEnd },
          },
        }),
        prisma.payment.aggregate({
          where: { userId: user.id, receivedAt: { not: null } },
          _sum: { amount: true },
        }),
        prisma.expens.aggregate({
          where: { userId: user.id },
          _sum: { amount: true },
        }),
      ]);

    // Baseline: cash already received, less expenses to date.
    const baselineBalance = round2(
      num(receivedAgg._sum.amount) - num(expenseAgg._sum.amount),
    );
    const generatedAt = new Date();

    const rows = HORIZONS.map((horizonDays) => {
      const end = new Date(start.getTime() + horizonDays * DAY_MS);

      const invoiceInflow = invoices
        .filter((i) => i.dueDate.getTime() < end.getTime())
        .reduce((sum, i) => sum + num(i.balanceDue), 0);

      const paymentInflow = expectedPayments
        .filter(
          (p) =>
            p.expectedDate !== null &&
            p.expectedDate.getTime() < end.getTime(),
        )
        .reduce((sum, p) => sum + num(p.amount), 0);

      const projectedInflow = round2(invoiceInflow + paymentInflow);

      const projectedOutflow = round2(
        bills.reduce((sum, bill) => sum + billOutflow(bill, start, end), 0),
      );

      const netCashflow = round2(projectedInflow - projectedOutflow);
      const projectedBalance = round2(baselineBalance + netCashflow);
      const shortfallAmount = round2(Math.max(0, -projectedBalance));

      return {
        horizonDays,
        projectedInflow,
        projectedOutflow,
        netCashflow,
        baselineBalance,
        projectedBalance,
        shortfallAmount,
        generatedAt,
        businessId,
        userId: user.id,
      };
    });

    const cashflowForecasts = await prisma.$transaction(
      rows.map((data) => prisma.cashflowForecast.create({ data })),
    );

    return NextResponse.json({ cashflowForecasts });
  } catch (e) {
    console.error('cashflow forecast generate failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}