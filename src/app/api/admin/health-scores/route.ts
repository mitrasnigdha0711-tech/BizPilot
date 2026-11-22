import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const OWNER_ROLE = 'small_video_editing_business_owner';
const DAY_MS = 24 * 60 * 60 * 1000;
const HORIZONS = [30, 60, 90] as const;
const DRAG_THRESHOLD = 70;

type AreaKey =
  | 'project_consistency'
  | 'payment_collection'
  | 'cashflow_stability'
  | 'workload'
  | 'expense_management';

type Drag = { area: AreaKey; score: number; reason: string };

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function ratioPercent(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return (numerator / denominator) * 100;
}

async function resolveBusinessId(userId: string): Promise<string | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { businessId: true },
  });
  return row?.businessId ?? null;
}

function buildDrags(scores: Record<AreaKey, number>): Drag[] {
  const reasons: Record<AreaKey, string> = {
    project_consistency: 'Too few projects were completed by their deadline in the last 90 days',
    payment_collection: 'Invoices issued in the last 90 days have a large unpaid share',
    cashflow_stability: 'One or more forecast horizons show a projected shortfall',
    workload: 'Progress toward the monthly project target is low for the active projects',
    expense_management: 'Expenses in the last 30 days consume too much of the cash received',
  };
  const areas = Object.keys(scores) as AreaKey[];
  return areas
    .filter((area) => scores[area] < DRAG_THRESHOLD)
    .map((area) => ({ area, score: scores[area], reason: reasons[area] }))
    .sort((a, b) => a.score - b.score);
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (user.role !== OWNER_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const businessId = await resolveBusinessId(user.id);
    if (!businessId) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const latest = await prisma.healthScore.findFirst({
      where: { businessId },
      orderBy: { generatedAt: 'desc' },
    });
    if (!latest) {
      return NextResponse.json({ error: 'No health score yet' }, { status: 404 });
    }

    const drags = Array.isArray(latest.dragFactors) ? latest.dragFactors : [];
    return NextResponse.json({ healthScore: { ...latest, drags } });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (user.role !== OWNER_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const businessId = await resolveBusinessId(user.id);
    if (!businessId) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { monthlyProjectTarget: true },
    });
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const now = new Date();
    const window90 = new Date(now.getTime() - 90 * DAY_MS);
    const window30 = new Date(now.getTime() - 30 * DAY_MS);

    // Project consistency: completed projects finished on or before their deadline
    const projects = await prisma.project.findMany({
      where: { businessId },
      select: { status: true, deadline: true, completedAt: true, startDate: true },
    });
    const completedRecent = projects.filter(
      (p) => p.status === 'COMPLETED' && p.completedAt !== null && p.completedAt >= window90,
    );
    const onTime = completedRecent.filter(
      (p) =>
        p.completedAt !== null &&
        p.completedAt.getTime() < p.deadline.getTime() + DAY_MS,
    ).length;
    const projectConsistency = clampScore(ratioPercent(onTime, completedRecent.length));

    // Payment collection: amount paid / amount invoiced over last 90 days
    const invoices = await prisma.invoice.findMany({
      where: { businessId, issueDate: { gte: window90 } },
      select: { amount: true, amountPaid: true },
    });
    const invoiced = invoices.reduce((sum, inv) => sum + inv.amount.toNumber(), 0);
    const paid = invoices.reduce((sum, inv) => sum + inv.amountPaid.toNumber(), 0);
    const paymentCollection = clampScore(ratioPercent(paid, invoiced));

    // Cashflow stability: latest forecast per horizon, minus 25 per shortfall
    const forecasts = await prisma.cashflowForecast.findMany({
      where: { businessId },
      orderBy: { generatedAt: 'desc' },
      take: 30,
    });
    const latestByHorizon = new Map<number, (typeof forecasts)[number]>();
    for (const f of forecasts) {
      if (!latestByHorizon.has(f.horizonDays)) latestByHorizon.set(f.horizonDays, f);
    }
    const presentHorizons = HORIZONS.filter((h) => latestByHorizon.has(h));
    const shortfallCount = presentHorizons.filter(
      (h) => (latestByHorizon.get(h)?.shortfallAmount.toNumber() ?? 0) > 0,
    ).length;
    const cashflowStability =
      presentHorizons.length === 0 ? 0 : clampScore(100 - 25 * shortfallCount);

    // Workload: active projects against monthly target, capped at 100
    const activeProjects = projects.filter(
      (p) => p.status === 'PLANNED' || p.status === 'IN_PROGRESS',
    ).length;
    const workload = clampScore(
      Math.min(100, ratioPercent(activeProjects, business.monthlyProjectTarget)),
    );

    // Expense management: 100 minus expenses as % of cash received, last 30 days
    const expenses = await prisma.expens.findMany({
      where: { businessId, expenseDate: { gte: window30 } },
      select: { amount: true },
    });
    const expenseTotal = expenses.reduce((sum, e) => sum + e.amount.toNumber(), 0);
    const received30 = await prisma.payment.findMany({
      where: { businessId: undefined, invoice: { businessId }, receivedAt: { gte: window30 } },
      select: { amount: true },
    });
    const cashReceived = received30.reduce((sum, p) => sum + p.amount.toNumber(), 0);
    const expenseManagement =
      cashReceived <= 0
        ? 0
        : clampScore(100 - ratioPercent(expenseTotal, cashReceived));

    const scores: Record<AreaKey, number> = {
      project_consistency: projectConsistency,
      payment_collection: paymentCollection,
      cashflow_stability: cashflowStability,
      workload,
      expense_management: expenseManagement,
    };

    const overall = clampScore(
      (projectConsistency +
        paymentCollection +
        cashflowStability +
        workload +
        expenseManagement) /
        5,
    );

    const drags = buildDrags(scores);

    const created = await prisma.healthScore.create({
      data: {
        overallScore: overall,
        projectConsistencyScore: projectConsistency,
        paymentCollectionScore: paymentCollection,
        cashflowStabilityScore: cashflowStability,
        workloadScore: workload,
        expenseManagementScore: expenseManagement,
        generatedAt: now,
        businessId,
        userId: user.id,
        dragFactors: drags,
      },
    });

    return NextResponse.json({ healthScore: { ...created, drags } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}