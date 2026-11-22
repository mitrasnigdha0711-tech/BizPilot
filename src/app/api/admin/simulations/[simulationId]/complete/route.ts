import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const HORIZONS = [30, 60, 90] as const;
const DAY_MS = 24 * 60 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNPAID_STATUSES = ['SENT', 'OVERDUE', 'PARTIALLY_PAID'] as const;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function POST(
  request: Request,
  { params }: { params: { simulationId: string } }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    if (!dbUser || dbUser.role !== 'SMALL_VIDEO_EDITING_BUSINESS_OWNER') {
      return NextResponse.json(
        { error: 'Not available for your role' },
        { status: 403 }
      );
    }

    const simulationId = params.simulationId;
    if (!UUID_RE.test(simulationId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const simulation = await prisma.simulation.findFirst({
      where: { id: simulationId, userId: user.id },
    });
    if (!simulation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Validate and load the referenced invoice for delayed-payment scenarios.
    let invoice: {
      dueDate: Date;
      balanceDue: Prisma.Decimal;
    } | null = null;
    let projectedPaymentDate: Date | null = null;
    let delayedBalance = 0;

    if (simulation.scenarioType === 'DELAYED_PAYMENT') {
      if (!simulation.invoiceId) {
        return NextResponse.json(
          { error: 'Please select an unpaid invoice for this simulation.' },
          { status: 400 }
        );
      }
      if (
        simulation.delayDays === null ||
        simulation.delayDays === undefined ||
        !Number.isInteger(simulation.delayDays) ||
        simulation.delayDays < 1 ||
        simulation.delayDays > 180
      ) {
        return NextResponse.json(
          { error: 'Enter a whole number of delay days between 1 and 180.' },
          { status: 400 }
        );
      }

      const found = await prisma.invoice.findFirst({
        where: { id: simulation.invoiceId, userId: user.id },
        select: { dueDate: true, balanceDue: true, status: true },
      });
      if (
        !found ||
        !UNPAID_STATUSES.includes(found.status as (typeof UNPAID_STATUSES)[number]) ||
        Number(found.balanceDue) <= 0
      ) {
        return NextResponse.json(
          { error: 'Please select an unpaid invoice for this simulation.' },
          { status: 400 }
        );
      }

      invoice = { dueDate: found.dueDate, balanceDue: found.balanceDue };
      const shifted = new Date(found.dueDate.getTime());
      projectedPaymentDate = new Date(
        Date.UTC(
          shifted.getUTCFullYear(),
          shifted.getUTCMonth(),
          shifted.getUTCDate() + simulation.delayDays
        )
      );
      delayedBalance = Number(found.balanceDue);
    }

    // Latest stored forecast per horizon is the baseline for the impact.
    const forecasts = await prisma.cashflowForecast.findMany({
      where: { userId: user.id, horizonDays: { in: [...HORIZONS] } },
      orderBy: { generatedAt: 'desc' },
    });
    const baselineByHorizon = new Map<number, (typeof forecasts)[number]>();
    for (const f of forecasts) {
      if (!baselineByHorizon.has(f.horizonDays)) {
        baselineByHorizon.set(f.horizonDays, f);
      }
    }
    if (HORIZONS.some((h) => !baselineByHorizon.has(h))) {
      return NextResponse.json(
        { error: 'Run a cashflow forecast before completing this simulation.' },
        { status: 409 }
      );
    }

    const referenceTime = Math.max(
      ...HORIZONS.map((h) => baselineByHorizon.get(h)!.generatedAt.getTime())
    );

    const horizons = HORIZONS.map((h) => {
      const f = baselineByHorizon.get(h)!;
      const horizonEnd = referenceTime + h * DAY_MS;

      const movedOut =
        invoice !== null &&
        projectedPaymentDate !== null &&
        invoice.dueDate.getTime() <= horizonEnd &&
        projectedPaymentDate.getTime() > horizonEnd;
      const movedAmount = movedOut ? delayedBalance : 0;

      const baselineInflow = Number(f.projectedInflow);
      const projectedInflow = baselineInflow - movedAmount;
      const projectedNet = Number(f.netCashflow) - movedAmount;
      const baselineBalance = Number(f.baselineBalance ?? 0);
      const projectedBalance = baselineBalance + projectedNet;
      const shortfallAmount = Math.max(0, -projectedBalance);

      return {
        horizon_days: h,
        baseline_inflow: round2(baselineInflow),
        projected_inflow: round2(projectedInflow),
        projected_balance: round2(projectedBalance),
        shortfall_amount: round2(shortfallAmount),
      };
    });

    const worst = horizons.reduce((a, b) =>
      b.projected_balance < a.projected_balance ? b : a
    );

    const updated = await prisma.simulation.update({
      where: { id: simulation.id },
      data: {
        status: 'COMPLETED',
        projectedPaymentDate,
        projectedBalance: new Prisma.Decimal(worst.projected_balance),
        shortfallAmount: new Prisma.Decimal(worst.shortfall_amount),
      },
    });

    return NextResponse.json({ simulation: updated, horizons });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}