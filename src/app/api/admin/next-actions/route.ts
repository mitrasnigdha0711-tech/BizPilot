import { NextResponse } from 'next/server';
import { InsightStatus, InsightType, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const PRIORITY_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const MAX_ACTIONS = 5;
const CANDIDATE_LIMIT = 100;

function dueTime(value: Date | null): number {
  return value ? new Date(value).getTime() : Number.POSITIVE_INFINITY;
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, businessId: true },
    });

    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (me.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!me.businessId) {
      return NextResponse.json({ nextActions: [] });
    }

    const now = new Date();

    const candidates = await prisma.insight.findMany({
      where: {
        businessId: me.businessId,
        type: InsightType.NEXT_ACTION,
        status: InsightStatus.OPEN,
        isStale: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        recommendedAction: true,
        priority: true,
        status: true,
        dueDate: true,
        invoiceId: true,
        projectId: true,
        generatedAt: true,
      },
      orderBy: { generatedAt: 'desc' },
      take: CANDIDATE_LIMIT,
    });

    const nextActions = [...candidates]
      .sort((a, b) => {
        const rankA = PRIORITY_RANK[a.priority] ?? 3;
        const rankB = PRIORITY_RANK[b.priority] ?? 3;
        if (rankA !== rankB) return rankA - rankB;
        return dueTime(a.dueDate) - dueTime(b.dueDate);
      })
      .slice(0, MAX_ACTIONS);

    return NextResponse.json({ nextActions });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}