import { NextResponse } from 'next/server';
import {
  Prisma,
  Role,
  Simulation,
  SimulationScenarioType,
  SimulationStatus,
  InvoiceStatus,
  RecurringBillStatus,
} from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const HORIZON_DAYS = 90;
const DAY_MS = 86_400_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNPAID_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

type DecimalLike = { toString(): string };

function toNum(value: DecimalLike | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function dayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toDayDate(date: Date): Date {
  return new Date(`${dayString(date)}T00:00:00Z`);
}

function serializeSimulation(sim: Simulation) {
  return {
    ...sim,
    projectedBalance: sim.projectedBalance === null ? null : toNum(sim.projectedBalance),
    shortfallAmount: sim.shortfallAmount === null ? null : toNum(sim.shortfallAmount),
    projectedPaymentDate: sim.projectedPaymentDate ? dayString(sim.projectedPaymentDate) : null,
  };
}

export async function POST(
  request: Request,
  { params }: { params: { simulationId: string } }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const actor = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, businessId: true },
    });
    if (!actor) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (actor.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
      return NextResponse.json({ error: 'Not available for your role' }, { status: 403 });
    }
    if (!actor.businessId) {
      return NextResponse.json({ error: 'Business setup is required' }, { status: 400 });
    }
    const businessId = actor.businessId;

    if (!UUID_RE.test(params.simulationId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const simulation = await prisma.simulation.findFirst({
      where: { id: params.simulationId, businessId, userId: user.id },
    });
    if (!simulation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (simulation.status !== SimulationStatus.DRAFT) {
      return NextResponse.json(
        { error: 'This simulation has already been run' },
        { status: 409 }
      );
    }
    if (simulation.name.length > 80) {
      return NextResponse.json(
        { error: 'Simulation name must be 80 characters or fewer.' },
        { status: 422 }
      );
    }

    const now = new Date();
    const horizonEnd = new Date(now.getTime() + HORIZON_DAYS * DAY_MS);

    let delayedInvoiceId: string | null = null;
    let projectedPaymentDate: Date | null = null;

    if (simulation.scenarioType === SimulationScenarioType.DELAYED_PAYMENT) {
      const delayDays = simulation.delayDays;
      if (
        delayDays === null ||
        !Number.isInteger(delayDays) ||
        delayDays < 1 ||
        delayDays > 180
      ) {
        return NextResponse.json(
          { error: 'Enter a whole number of delay days between 1 and 180.' },
          { status: 422 }
        );
      }
      if (!simulation.invoiceId) {
        return NextResponse.json(
          { error: 'Please select an unpaid invoice for this simulation.' },
          { status: 422 }
        );
      }

      const invoice = await prisma.invoice.findFirst({
        where: { id: simulation.invoiceId, businessId },
        select: { id: true, status: true, dueDate: true, balanceDue: true },
      });
      if (
        !invoice ||
        !UNPAID_STATUSES.includes(invoice.status) ||
        toNum(invoice.balanceDue) <= 0
      ) {
        return NextResponse.json(
          { error: 'Please select an unpaid invoice for this simulation.' },
          { status: 422 }
        );
      }

      delayedInvoiceId = invoice.id;
      projectedPaymentDate = toDayDate(
        new Date(invoice.dueDate.getTime() + delayDays * DAY_MS)
      );
    }

    const [unpaidInvoices, paidAgg, expenseAgg, activeBills] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          businessId,
          status: { in: UNPAID_STATUSES },
          balanceDue: { gt: 0 },
        },
        select: { id: true, dueDate: true, balanceDue: true },
      }),
      prisma.invoice.aggregate({
        where: { businessId },
        _sum: { amountPaid: true },
      }),
      prisma.expens.aggregate({
        where: { businessId },
        _sum: { amount: true },
      }),
      prisma.recurringBill.findMany({
        where: {
          businessId,
          status: RecurringBillStatus.ACTIVE,
          nextDueDate: { lte: horizonEnd },
        },
        select: { amount: true },
      }),
    ]);

    const baselineBalance =
      toNum(paidAgg._sum.amountPaid) - toNum(expenseAgg._sum.amount);

    let projectedInflow = 0;
    for (const inv of unpaidInvoices) {
      const effectiveDate =
        inv.id === delayedInvoiceId && projectedPaymentDate
          ? projectedPaymentDate
          : inv.dueDate;
      if (effectiveDate.getTime() <= horizonEnd.getTime()) {
        projectedInflow += toNum(inv.balanceDue);
      }
    }

    const projectedOutflow = activeBills.reduce(
      (sum, bill) => sum + toNum(bill.amount),
      0
    );

    const projectedBalance =
      baselineBalance + projectedInflow - projectedOutflow;
    const shortfallAmount = Math.max(0, -projectedBalance);

    const updated = await prisma.simulation.update({
      where: { id: simulation.id },
      data: {
        status: SimulationStatus.COMPLETED,
        projectedPaymentDate,
        projectedBalance: round2(projectedBalance),
        shortfallAmount: round2(shortfallAmount),
      },
    });

    return NextResponse.json({
      simulation: serializeSimulation(updated),
      projected_payment_date: projectedPaymentDate ? dayString(projectedPaymentDate) : null,
      baseline_balance: round2(baselineBalance),
      projected_balance: round2(projectedBalance),
      shortfall_amount: round2(shortfallAmount),
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}