import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const AREAS = [
  { area: 'project_consistency', field: 'projectConsistencyScore' },
  { area: 'payment_collection', field: 'paymentCollectionScore' },
  { area: 'cashflow_stability', field: 'cashflowStabilityScore' },
  { area: 'workload', field: 'workloadScore' },
  { area: 'expense_management', field: 'expenseManagementScore' },
] as const;

const DEFAULT_TARGET = 80;

function toScore(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function reasonFor(area: string, score: number, dragFactors: unknown): string {
  if (isRecord(dragFactors)) {
    const stored = dragFactors[area];
    if (typeof stored === 'string' && stored.trim().length > 0) {
      return stored;
    }
  }
  if (score >= DEFAULT_TARGET) {
    return 'Nothing significant is pulling this down';
  }
  return `Score of ${score} is below the ${DEFAULT_TARGET}-point target`;
}

export async function GET(request: Request) {
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

    if (dbUser.role !== 'SMALL_VIDEO_EDITING_BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!dbUser.businessId) {
      return NextResponse.json({ error: 'Health score not found' }, { status: 404 });
    }

    const record = await prisma.healthScore.findFirst({
      where: { businessId: dbUser.businessId },
      orderBy: { generatedAt: 'desc' },
    });

    if (!record) {
      return NextResponse.json({ error: 'Health score not found' }, { status: 404 });
    }

    const areaScores = AREAS.map(({ area, field }) => ({
      area,
      score: toScore(record[field]),
    }));

    const overallScore = Math.round(
      areaScores.reduce((sum, a) => sum + a.score, 0) / areaScores.length,
    );

    const drivers = areaScores.map(({ area, score }) => ({
      area,
      score,
      pulled_down_by: reasonFor(area, score, record.dragFactors),
    }));

    const healthScore = {
      ...record,
      overallScore: toScore(overallScore),
      projectConsistencyScore: areaScores[0].score,
      paymentCollectionScore: areaScores[1].score,
      cashflowStabilityScore: areaScores[2].score,
      workloadScore: areaScores[3].score,
      expenseManagementScore: areaScores[4].score,
      drivers,
    };

    return NextResponse.json({ healthScore });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}