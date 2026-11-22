import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const OWNER_ROLE = 'small_video_editing_business_owner';
const DAY_MS = 86_400_000;
const WINDOW_DAYS = 90;
const CASH_WINDOW_DAYS = 30;

function isBusinessOwner(role: unknown): boolean {
  return typeof role === 'string' && role.toLowerCase() === OWNER_ROLE;
}

function toNumber(value: unknown): number {
  const n = Number(String(value ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    if (user instanceof Response) return user;

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, businessId: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isBusinessOwner(dbUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const business = await prisma.business.findFirst({
      where: {
        OR: [
          { userId: user.id },
          ...(dbUser.businessId ? [{ id: dbUser.businessId }] : []),
        ],
      },
      select: { id: true, monthlyProjectTarget: true },
    });
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const businessId = business.id;
    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);
    const cashWindowStart = new Date(now.getTime() - CASH_WINDOW_DAYS * DAY_MS);

    const [
      completedRecent,
      activeProjectCount,
      invoicesRecent,
      businessInvoiceIds,
      forecasts,
      expensesRecent,
    ] = await Promise.all([
      prisma.project.findMany({
        where: {
          businessId,
          status: 'COMPLETED',
          completedAt: { gte: windowStart },
        },
        select: { deadline: true, completedAt: true },
      }),
      prisma.project.count({
        where: { businessId, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
      }),
      prisma.invoice.findMany({
        where: { businessId, issueDate: { gte: windowStart } },
        select: { amount: true, amountPaid: true },
      }),
      prisma.invoice.findMany({
        where: { businessId },
        select: { id: true },
      }),
      prisma.cashflowForecast.findMany({
        where: { businessId, horizonDays: { in: [30, 60, 90] } },
        orderBy: { generatedAt: 'desc' },
        take: 30,
        select: { horizonDays: true, shortfallAmount: true },
      }),
      prisma.expens.findMany({
        where: { businessId, expenseDate: { gte: cashWindowStart } },
        select: { amount: true },
      }),
    ]);

    const invoiceIds = businessInvoiceIds.map((i) => i.id);
    const receivedRecent = invoiceIds.length
      ? await prisma.payment.findMany({
          where: {
            invoiceId: { in: invoiceIds },
            status: 'RECEIVED',
            receivedAt: { gte: cashWindowStart },
          },
          select: { amount: true },
        })
      : [];

    // 1. Project consistency: on-time completions / completions in window
    const completedCount = completedRecent.length;
    const onTimeCount = completedRecent.filter((p) => {
      if (!p.completedAt) return false;
      const deadlineEnd = new Date(p.deadline).getTime() + DAY_MS - 1;
      return p.completedAt.getTime() <= deadlineEnd;
    }).length;
    const projectConsistencyScore = completedCount
      ? clampScore((onTimeCount / completedCount) * 100)
      : 0;

    // 2. Payment collection: amount paid / amount invoiced in window
    const invoicedTotal = invoicesRecent.reduce((s, i) => s + toNumber(i.amount), 0);
    const paidTotal = invoicesRecent.reduce((s, i) => s + toNumber(i.amountPaid), 0);
    const paymentCollectionScore = invoicedTotal > 0
      ? clampScore((paidTotal / invoicedTotal) * 100)
      : 0;

    // 3. Cashflow stability: 100 minus 25 per horizon with a shortfall (latest per horizon)
    const latestByHorizon = new Map<number, { shortfallAmount: unknown }>();
    for (const f of forecasts) {
      if (!latestByHorizon.has(f.horizonDays)) {
        latestByHorizon.set(f.horizonDays, { shortfallAmount: f.shortfallAmount });
      }
    }
    const horizonsWithShortfall = Array.from(latestByHorizon.values()).filter(
      (f) => toNumber(f.shortfallAmount) > 0,
    ).length;
    const cashflowStabilityScore = latestByHorizon.size
      ? clampScore(100 - horizonsWithShortfall * 25)
      : 0;

    // 4. Workload: active projects / monthly target, capped at 100
    const target = business.monthlyProjectTarget;
    const workloadScore = target > 0
      ? clampScore(Math.min(100, (activeProjectCount / target) * 100))
      : 0;

    // 5. Expense management: 100 minus expenses as % of cash received (last 30 days)
    const expensesTotal = expensesRecent.reduce((s, e) => s + toNumber(e.amount), 0);
    const receivedTotal = receivedRecent.reduce((s, p) => s + toNumber(p.amount), 0);
    const expenseManagementScore = receivedTotal > 0
      ? clampScore(100 - (expensesTotal / receivedTotal) * 100)
      : 0;

    const overallScore = clampScore(
      (projectConsistencyScore +
        paymentCollectionScore +
        cashflowStabilityScore +
        workloadScore +
        expenseManagementScore) / 5,
    );

    const drivers = {
      project_consistency: completedCount
        ? `${onTimeCount} of ${completedCount} projects completed in the last ${WINDOW_DAYS} days were on time`
        : `No projects completed in the last ${WINDOW_DAYS} days`,
      payment_collection: invoicedTotal > 0
        ? `Collected ${paidTotal.toFixed(2)} of ${invoicedTotal.toFixed(2)} invoiced in the last ${WINDOW_DAYS} days`
        : `No invoices issued in the last ${WINDOW_DAYS} days`,
      cashflow_stability: latestByHorizon.size
        ? `${horizonsWithShortfall} of ${latestByHorizon.size} forecast horizons show a shortfall`
        : 'No cashflow forecasts stored yet',
      workload: target > 0
        ? `${activeProjectCount} active projects against a monthly target of ${target}`
        : 'No monthly project target set',
      expense_management: receivedTotal > 0
        ? `Expenses are ${((expensesTotal / receivedTotal) * 100).toFixed(1)}% of cash received in the last ${CASH_WINDOW_DAYS} days`
        : `No cash received in the last ${CASH_WINDOW_DAYS} days`,
    };

    const healthScore = await prisma.healthScore.create({
      data: {
        overallScore,
        projectConsistencyScore,
        paymentCollectionScore,
        cashflowStabilityScore,
        workloadScore,
        expenseManagementScore,
        generatedAt: now,
        businessId,
        userId: user.id,
        dragFactors: drivers,
      },
    });

    return NextResponse.json({
      healthScore: {
        ...healthScore,
        drivers,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}