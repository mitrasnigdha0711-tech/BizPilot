import { NextResponse } from 'next/server';
import { Prisma, type InvoiceStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const OWNER_ROLE = 'small_video_editing_business_owner';
const HORIZON_DAYS = 30;
const OPEN_INVOICE_STATUSES: InvoiceStatus[] = ['SENT', 'PARTIALLY_PAID', 'OVERDUE'];

function parseDay(day: string): Date {
  return new Date(day + 'T00:00:00Z');
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(day: string, days: number): string {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + days);
  return dayKey(d);
}

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

function toNumber(v: Prisma.Decimal | number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v));
  return Number.isFinite(n) ? n : 0;
}

function resolveToday(request: Request): string {
  const raw = new URL(request.url).searchParams.get('date');
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(parseDay(raw).getTime())) {
    return raw;
  }
  return new Date().toLocaleDateString('en-CA');
}

export async function POST(
  request: Request,
  { params }: { params: { simulationId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, businessId: true, isActive: true },
  });
  if (!dbUser || !dbUser.isActive) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (String(dbUser.role).toLowerCase() !== OWNER_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const businessId = dbUser.businessId;
  if (!businessId) {
    return NextResponse.json({ error: 'Simulation not found' }, { status: 404 });
  }

  const simulationId = params.simulationId;

  try {
    const simulation = await prisma.simulation.findFirst({
      where: { id: simulationId, userId: user.id, businessId },
    });
    if (!simulation) {
      return NextResponse.json({ error: 'Simulation not found' }, { status: 404 });
    }

    if (!simulation.scenarioType) {
      return NextResponse.json(
        { error: 'Please choose a scenario to simulate.' },
        { status: 400 },
      );
    }
    if (simulation.name.length > 80) {
      return NextResponse.json(
        { error: 'Simulation name must be 80 characters or fewer.' },
        { status: 400 },
      );
    }

    const today = resolveToday(request);
    const horizonEnd = addDays(today, HORIZON_DAYS);
    const horizonEndDate = parseDay(horizonEnd);

    const businessInvoices = await prisma.invoice.findMany({
      where: { businessId },
      select: { id: true, dueDate: true, balanceDue: true, status: true },
    });
    const openInvoices = businessInvoices.filter(
      (inv) => OPEN_INVOICE_STATUSES.includes(inv.status) && toNumber(inv.balanceDue) > 0,
    );
    const invoiceIds = businessInvoices.map((inv) => inv.id);

    let targetInvoiceId: string | null = null;
    let projectedKey: string | null = null;
    let projectedPaymentDate: Date | null = null;

    if (simulation.scenarioType === 'DELAYED_PAYMENT') {
      const delayDays = simulation.delayDays;
      if (delayDays !== null && delayDays !== undefined && !Number.isInteger(delayDays)) {
        return NextResponse.json(
          { error: 'Delay days must be a whole number, such as 14 or 30.' },
          { status: 400 },
        );
      }
      if (delayDays === null || delayDays === undefined || delayDays < 1 || delayDays > 180) {
        return NextResponse.json(
          { error: 'Enter a whole number of delay days between 1 and 180.' },
          { status: 400 },
        );
      }
      if (!simulation.invoiceId) {
        return NextResponse.json(
          { error: 'Please select an unpaid invoice for this simulation.' },
          { status: 400 },
        );
      }

      const target = openInvoices.find((inv) => inv.id === simulation.invoiceId);
      if (!target) {
        return NextResponse.json(
          { error: 'Please select an unpaid invoice for this simulation.' },
          { status: 400 },
        );
      }

      targetInvoiceId = target.id;
      projectedKey = addDays(dayKey(target.dueDate), delayDays);
      projectedPaymentDate = parseDay(projectedKey);
    }

    const [receivedAgg, expenseAgg, bills, paymentsAgg] = await Promise.all([
      prisma.payment.aggregate({
        where: { invoiceId: { in: invoiceIds }, receivedAt: { not: null } },
        _sum: { amount: true },
      }),
      prisma.expens.aggregate({
        where: { businessId },
        _sum: { amount: true },
      }),
      prisma.recurringBill.findMany({
        where: { businessId, status: 'ACTIVE', nextDueDate: { lte: horizonEndDate } },
        select: { amount: true },
      }),
      Promise.resolve(null),
    ]);
    void paymentsAgg;

    const baselineBalance =
      toNumber(receivedAgg._sum.amount) - toNumber(expenseAgg._sum.amount);

    const outflow = bills.reduce((sum, b) => sum + toNumber(b.amount), 0);

    let baselineInflow = 0;
    let projectedInflow = 0;
    for (const inv of openInvoices) {
      const balance = toNumber(inv.balanceDue);
      const dueKey = dayKey(inv.dueDate);
      if (dueKey <= horizonEnd) baselineInflow += balance;

      const effectiveKey = inv.id === targetInvoiceId && projectedKey ? projectedKey : dueKey;
      if (effectiveKey <= horizonEnd) projectedInflow += balance;
    }

    const projectedBalance = baselineBalance + projectedInflow - outflow;
    const shortfall = Math.max(0, -projectedBalance);

    const updated = await prisma.simulation.update({
      where: { id: simulation.id },
      data: {
        projectedPaymentDate,
        projectedBalance: money(projectedBalance),
        shortfallAmount: money(shortfall),
        status: 'COMPLETED',
      },
    });

    return NextResponse.json({
      simulation: {
        ...updated,
        projectedBalance: toNumber(updated.projectedBalance),
        shortfallAmount: toNumber(updated.shortfallAmount),
        projectedPaymentDate: updated.projectedPaymentDate
          ? dayKey(updated.projectedPaymentDate)
          : null,
      },
      projected_payment_date: projectedPaymentDate ? dayKey(projectedPaymentDate) : null,
      baseline_balance: money(baselineBalance),
      projected_balance: money(projectedBalance),
      shortfall_amount: money(shortfall),
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('simulation run failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}