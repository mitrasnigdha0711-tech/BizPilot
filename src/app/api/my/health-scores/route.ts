import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

type Drag = { area: string; score: number; reason: string };

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function isDrag(x: unknown): x is Drag {
  if (typeof x !== 'object' || x === null) return false;
  const d = x as Record<string, unknown>;
  return typeof d.area === 'string' && typeof d.score === 'number' && typeof d.reason === 'string';
}

function toPayload(
  row: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    overallScore: number;
    projectConsistencyScore: number;
    paymentCollectionScore: number;
    cashflowStabilityScore: number;
    workloadScore: number;
    expenseManagementScore: number;
    generatedAt: Date;
    businessId: string;
    userId: string;
  },
  drags: Drag[],
) {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    overallScore: row.overallScore,
    projectConsistencyScore: row.projectConsistencyScore,
    paymentCollectionScore: row.paymentCollectionScore,
    cashflowStabilityScore: row.cashflowStabilityScore,
    workloadScore: row.workloadScore,
    expenseManagementScore: row.expenseManagementScore,
    generatedAt: row.generatedAt,
    businessId: row.businessId,
    userId: row.userId,
    drags,
  };
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (user.role !== 'FREELANCE_VIDEO_EDITOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const latest = await prisma.healthScore.findFirst({
      where: { userId: user.id },
      orderBy: { generatedAt: 'desc' },
    });
    if (!latest) {
      return NextResponse.json({ error: 'No health score yet' }, { status: 404 });
    }

    const raw: unknown = latest.dragFactors;
    const drags: Drag[] = Array.isArray(raw) ? raw.filter(isDrag) : [];

    return NextResponse.json({ healthScore: toPayload(latest, drags) });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (user.role !== 'FREELANCE_VIDEO_EDITOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { businessId: true },
    });
    if (!dbUser?.businessId) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const business = await prisma.business.findUnique({
      where: { id: dbUser.businessId },
      select: { monthlyProjectTarget: true },
    });
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const now = Date.now();
    const since90 = new Date(now - 90 * DAY_MS);
    const since30 = new Date(now - 30 * DAY_MS);

    // Project consistency: completed projects delivered by their deadline (last 90 days)
    const completed = await prisma.project.findMany({
      where: { userId: user.id, status: 'COMPLETED', completedAt: { gte: since90 } },
      select: { completedAt: true, deadline: true },
    });
    const onTime = completed.filter(
      (p) =>
        p.completedAt !== null &&
        p.completedAt.toISOString().slice(0, 10) <= p.deadline.toISOString().slice(0, 10),
    ).length;
    const projectConsistency = completed.length > 0 ? clamp((onTime / completed.length) * 100) : 0;

    // Payment collection: amount paid / amount invoiced (last 90 days)
    const invoices = await prisma.invoice.findMany({
      where: { userId: user.id, issueDate: { gte: since90 } },
      select: { amount: true, amountPaid: true },
    });
    const invoiced = invoices.reduce((sum, i) => sum + i.amount.toNumber(), 0);
    const paid = invoices.reduce((sum, i) => sum + i.amountPaid.toNumber(), 0);
    const paymentCollection = invoiced > 0 ? clamp((paid / invoiced) * 100) : 0;

    // Cashflow stability: 100 minus 25 per horizon with a shortfall (latest forecast per horizon)
    const horizons = [30, 60, 90];
    let shortfallHorizons = 0;
    let forecastCount = 0;
    for (const h of horizons) {
      const f = await prisma.cashflowForecast.findFirst({
        where: { userId: user.id, horizonDays: h },
        orderBy: { generatedAt: 'desc' },
        select: { shortfallAmount: true },
      });
      if (f) {
        forecastCount += 1;
        if (f.shortfallAmount.toNumber() > 0) shortfallHorizons += 1;
      }
    }
    const cashflowStability = forecastCount > 0 ? clamp(100 - 25 * shortfallHorizons) : 0;

    // Workload: active (in-progress) projects against the monthly target, capped at 100
    const activeProjects = await prisma.project.count({
      where: { userId: user.id, status: 'IN_PROGRESS' },
    });
    const target = business.monthlyProjectTarget;
    const workload = target > 0 ? clamp((activeProjects / target) * 100) : 0;

    // Expense management: 100 minus expenses as a % of cash received (last 30 days)
    const received30 = await prisma.payment.findMany({
      where: { userId: user.id, receivedAt: { gte: since30 } },
      select: { amount: true },
    });
    const cashReceived30 = received30.reduce((sum, p) => sum + p.amount.toNumber(), 0);
    const expenses30 = await prisma.expens.findMany({
      where: { userId: user.id, expenseDate: { gte: since30 } },
      select: { amount: true },
    });
    const expensesTotal30 = expenses30.reduce((sum, e) => sum + e.amount.toNumber(), 0);
    const expenseRatio = cashReceived30 > 0 ? (expensesTotal30 / cashReceived30) * 100 : 0;
    const expenseManagement = cashReceived30 > 0 ? clamp(100 - expenseRatio) : 0;

    const overallScore = clamp(
      (projectConsistency + paymentCollection + cashflowStability + workload + expenseManagement) / 5,
    );

    const areas: Drag[] = [
      {
        area: 'project_consistency',
        score: projectConsistency,
        reason:
          completed.length > 0
            ? `${onTime} of ${completed.length} projects completed in the last 90 days were delivered by their deadline`
            : 'No projects were completed in the last 90 days',
      },
      {
        area: 'payment_collection',
        score: paymentCollection,
        reason:
          invoiced > 0
            ? `${paymentCollection}% of invoiced value has been paid in the last 90 days`
            : 'No invoices were issued in the last 90 days',
      },
      {
        area: 'cashflow_stability',
        score: cashflowStability,
        reason:
          forecastCount > 0
            ? `${shortfallHorizons} of ${forecastCount} forecast horizons show a cashflow shortfall`
            : 'No cashflow forecasts have been generated yet',
      },
      {
        area: 'workload',
        score: workload,
        reason: `${activeProjects} active projects against a monthly target of ${target}`,
      },
      {
        area: 'expense_management',
        score: expenseManagement,
        reason:
          cashReceived30 > 0
            ? `Expenses equal ${Math.round(expenseRatio)}% of cash received in the last 30 days`
            : 'No cash was received in the last 30 days',
      },
    ];

    const drags: Drag[] = [...areas]
      .filter((a) => a.score < 100)
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);

    const created = await prisma.healthScore.create({
      data: {
        overallScore,
        projectConsistencyScore: projectConsistency,
        paymentCollectionScore: paymentCollection,
        cashflowStabilityScore: cashflowStability,
        workloadScore: workload,
        expenseManagementScore: expenseManagement,
        generatedAt: new Date(),
        businessId: dbUser.businessId,
        userId: user.id,
        dragFactors: drags,
      },
    });

    return NextResponse.json({ healthScore: toPayload(created, drags) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}