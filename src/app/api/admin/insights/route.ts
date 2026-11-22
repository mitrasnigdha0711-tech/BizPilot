import { NextRequest, NextResponse } from 'next/server';
import type { InsightType, Priority } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const OWNER_ROLE = 'small_video_editing_business_owner';

const TYPE_FILTERS: Record<string, InsightType> = {
  business_advice: 'BUSINESS_ADVICE',
  growth_insight: 'GROWTH_INSIGHT',
  alert: 'ALERT',
  next_action: 'NEXT_ACTION',
};

const PRIORITY_RANK: Record<Priority, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

function groupRank(insight: { isAlert: boolean; type: InsightType }): number {
  if (insight.isAlert || insight.type === 'ALERT') return 0;
  if (insight.type === 'GROWTH_INSIGHT') return 1;
  if (insight.type === 'BUSINESS_ADVICE') return 2;
  return 3;
}

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (String(user.role ?? '').toLowerCase() !== OWNER_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;

  const typeParam = searchParams.get('type');
  let typeFilter: InsightType | undefined;
  if (typeParam !== null && typeParam !== '') {
    typeFilter = TYPE_FILTERS[typeParam];
    if (!typeFilter) {
      return NextResponse.json(
        { error: 'type must be one of: business_advice, growth_insight, alert, next_action' },
        { status: 400 },
      );
    }
  }

  const isAlertParam = searchParams.get('is_alert');
  let isAlertFilter: boolean | undefined;
  if (isAlertParam !== null && isAlertParam !== '') {
    if (isAlertParam === 'true') isAlertFilter = true;
    else if (isAlertParam === 'false') isAlertFilter = false;
    else {
      return NextResponse.json({ error: 'is_alert must be true or false' }, { status: 400 });
    }
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { businessId: true },
    });

    if (!dbUser?.businessId) {
      return NextResponse.json({ insights: [] });
    }

    const insights = await prisma.insight.findMany({
      where: {
        businessId: dbUser.businessId,
        status: 'OPEN',
        ...(typeFilter ? { type: typeFilter } : {}),
        ...(isAlertFilter !== undefined ? { isAlert: isAlertFilter } : {}),
      },
      orderBy: { generatedAt: 'desc' },
    });

    insights.sort((a, b) => {
      const groupDiff = groupRank(a) - groupRank(b);
      if (groupDiff !== 0) return groupDiff;

      const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (priorityDiff !== 0) return priorityDiff;

      const aDue = a.dueDate ? a.dueDate.getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.dueDate ? b.dueDate.getTime() : Number.POSITIVE_INFINITY;
      if (aDue !== bDue) return aDue - bDue;

      return b.generatedAt.getTime() - a.generatedAt.getTime();
    });

    return NextResponse.json({ insights });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}