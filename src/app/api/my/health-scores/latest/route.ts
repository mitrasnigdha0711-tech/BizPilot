import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

const AREAS = [
  { area: 'project_consistency', field: 'projectConsistencyScore' },
  { area: 'payment_collection', field: 'paymentCollectionScore' },
  { area: 'cashflow_stability', field: 'cashflowStabilityScore' },
  { area: 'workload', field: 'workloadScore' },
  { area: 'expense_management', field: 'expenseManagementScore' },
] as const;

type AreaKey = (typeof AREAS)[number]['area'];

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function reasonFor(dragFactors: unknown, area: AreaKey): string {
  if (Array.isArray(dragFactors)) {
    for (const item of dragFactors) {
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>;
        if (rec.area === area && typeof rec.reason === 'string' && rec.reason.trim()) {
          return rec.reason;
        }
      }
    }
    return 'No specific drag recorded';
  }
  if (dragFactors && typeof dragFactors === 'object') {
    const value = (dragFactors as Record<string, unknown>)[area];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return 'No specific drag recorded';
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (String(dbUser.role) !== 'FREELANCE_VIDEO_EDITOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const latest = await prisma.healthScore.findFirst({
      where: { userId: user.id },
      orderBy: [{ generatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (!latest) {
      return NextResponse.json({ error: 'No health score found' }, { status: 404 });
    }

    const areaScores = AREAS.map(({ area, field }) => ({
      area,
      score: clampScore(Number(latest[field])),
    }));

    const overallScore = clampScore(
      areaScores.reduce((sum, a) => sum + a.score, 0) / areaScores.length,
    );

    const drivers = AREAS.map(({ area }) => {
      const found = areaScores.find((a) => a.area === area);
      return {
        area,
        score: found ? found.score : 0,
        pulled_down_by: reasonFor(latest.dragFactors, area),
      };
    });

    const healthScore = {
      id: latest.id,
      createdAt: latest.createdAt,
      updatedAt: latest.updatedAt,
      overallScore,
      projectConsistencyScore: clampScore(Number(latest.projectConsistencyScore)),
      paymentCollectionScore: clampScore(Number(latest.paymentCollectionScore)),
      cashflowStabilityScore: clampScore(Number(latest.cashflowStabilityScore)),
      workloadScore: clampScore(Number(latest.workloadScore)),
      expenseManagementScore: clampScore(Number(latest.expenseManagementScore)),
      generatedAt: latest.generatedAt,
      businessId: latest.businessId,
      userId: latest.userId,
      dragFactors: latest.dragFactors,
      drivers,
    };

    return NextResponse.json({ healthScore });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}