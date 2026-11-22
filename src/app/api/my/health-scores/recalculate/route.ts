import { NextResponse } from 'next/server';
import { Prisma, PaymentStatus, ProjectStatus, Role } from '@prisma/client';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_90_DAYS = 90 * DAY_MS;
const WINDOW_30_DAYS = 30 * DAY_MS;
const HORIZONS = [30, 60, 90] as const;

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

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, businessId: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (dbUser.role !== Role.FREELANCE_VIDEO_EDITOR) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!dbUser.businessId) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const businessId = dbUser.businessId;
    const userId = user.id;
    const now = new Date();
    const since90 = new Date(now.getTime() - WINDOW_90_DAYS);
    const since30 = new Date(now.getTime() - WINDOW_30_DAYS);

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { monthlyProjectTarget: true },
    });
    const monthlyTarget = business?.monthlyProjectTarget ?? 0;

    // 1. Project consistency: on-time completed / completed in last 90 days
    const completedProjects = await prisma.project.findMany({
      where: {
        userId,
        status: ProjectStatus.COMPLETED,
        completedAt: { gte: since90 },
      },
      select: { deadline: true, completedAt: true },
    });
    const completedCount = completedProjects.length;
    const onTimeCount = completedProjects.filter(
      (p) =>
        p.completedAt !== null &&
        p.completedAt.getTime() < p.deadline.getTime() + DAY_MS,
    ).length;
    const projectConsistencyRaw = ratioPercent(onTimeCount, completedCount);
    const projectConsistencyScore = clampScore(projectConsistencyRaw);

    // 2. Payment collection: amount received / amount due on invoices in last 90 days
    const invoices = await prisma.invoice.findMany({
      where: {
        userId,
        issueDate: { gte: since90 },
      },
      select: { amount: true, amountPaid: true },
    });
    const amountDue = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
    const amountReceivedFromInvoices = invoices.reduce(
      (sum, inv) => sum + Number(inv.amountPaid),
      0,
    );
    const paymentCollectionRaw = ratioPercent(amountReceivedFromInvoices, amountDue);
    const paymentCollectionScore = clampScore(paymentCollectionRaw);

    // 3. Cashflow stability: 100 minus 25 per horizon with a shortfall (latest forecast per horizon)
    const latestForecasts = await Promise.all(
      HORIZONS.map((horizonDays) =>
        prisma.cashflowForecast.findFirst({
          where: { userId, horizonDays },
          orderBy: { generatedAt: 'desc' },
          select: { horizonDays: true, shortfallAmount: true },
        }),
      ),
    );
    const horizonsWithShortfall = latestForecasts.filter(
      (f) => f !== null && Number(f.shortfallAmount) > 0,
    ).length;
    const cashflowStabilityRaw = 100 - horizonsWithShortfall * 25;
    const cashflowStabilityScore = clampScore(cashflowStabilityRaw);

    // 4. Workload: active projects / monthly target, capped at 100
    const activeProjectCount = await prisma.project.count({
      where: {
        userId,
        status: { in: [ProjectStatus.PLANNED, ProjectStatus.IN_PROGRESS] },
      },
    });
    const workloadRaw = monthlyTarget > 0 ? (activeProjectCount / monthlyTarget) * 100 : 0;
    const workloadScore = clampScore(Math.min(100, workloadRaw));

    // 5. Expense management: 100 minus expenses (30 days) as % of cash received (30 days)
    const expenseAgg = await prisma.expens.aggregate({
      where: {
        userId,
        expenseDate: { gte: since30 },
      },
      _sum: { amount: true },
    });
    const expensesLast30 = Number(expenseAgg._sum.amount ?? 0);

    const receivedAgg = await prisma.payment.aggregate({
      where: {
        userId,
        status: PaymentStatus.RECEIVED,
        receivedAt: { gte: since30 },
      },
      _sum: { amount: true },
    });
    const cashReceivedLast30 = Number(receivedAgg._sum.amount ?? 0);

    const expenseRatioPercent = ratioPercent(expensesLast30, cashReceivedLast30);
    const expenseManagementScore = clampScore(100 - expenseRatioPercent);

    // Overall: average of the five area scores
    const areaScores = [
      projectConsistencyScore,
      paymentCollectionScore,
      cashflowStabilityScore,
      workloadScore,
      expenseManagementScore,
    ];
    const overallScore = clampScore(
      areaScores.reduce((sum, s) => sum + s, 0) / areaScores.length,
    );

    const drivers = {
      project_consistency:
        completedCount === 0
          ? 'No projects completed in the last 90 days.'
          : `${onTimeCount} of ${completedCount} projects completed in the last 90 days were delivered by their deadline.`,
      payment_collection:
        amountDue <= 0
          ? 'No invoices issued in the last 90 days.'
          : `Collected ${amountReceivedFromInvoices.toFixed(2)} of ${amountDue.toFixed(2)} invoiced in the last 90 days.`,
      cashflow_stability:
        horizonsWithShortfall === 0
          ? 'No 30, 60 or 90 day forecast shows a shortfall.'
          : `${horizonsWithShortfall} forecast horizon(s) show a cashflow shortfall.`,
      workload:
        monthlyTarget <= 0
          ? 'No monthly project target is set for the business.'
          : `${activeProjectCount} active project(s) against a monthly target of ${monthlyTarget}.`,
      expense_management:
        cashReceivedLast30 <= 0
          ? 'No cash received in the last 30 days, so expenses are not offset by income.'
          : `Expenses were ${expenseRatioPercent.toFixed(1)}% of cash received in the last 30 days.`,
    };

    const generatedAt = new Date();

    const record = await prisma.healthScore.create({
      data: {
        overallScore,
        projectConsistencyScore,
        paymentCollectionScore,
        cashflowStabilityScore,
        workloadScore,
        expenseManagementScore,
        generatedAt,
        businessId,
        userId,
        dragFactors: drivers as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json({
      overall_score: overallScore,
      project_consistency_score: projectConsistencyScore,
      payment_collection_score: paymentCollectionScore,
      cashflow_stability_score: cashflowStabilityScore,
      workload_score: workloadScore,
      expense_management_score: expenseManagementScore,
      generated_at: record.generatedAt.toISOString(),
      drivers,
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}