import { NextResponse } from 'next/server';
import type { InsightType, Priority } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const REQUIRED_ROLE = 'freelance_video_editor';

const PRIORITY_RANK: Record<Priority, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

const INSIGHT_TYPES: InsightType[] = [
  'BUSINESS_ADVICE',
  'GROWTH_INSIGHT',
  'ALERT',
  'NEXT_ACTION',
];

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (user.role !== REQUIRED_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const isAlertParam = url.searchParams.get('is_alert');
  const typeParam = url.searchParams.get('type');

  let type: InsightType | undefined;
  if (typeParam) {
    const candidate = typeParam.toUpperCase() as InsightType;
    if (!INSIGHT_TYPES.includes(candidate)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    type = candidate;
  }

  try {
    const insights = await prisma.insight.findMany({
      where: {
        userId: user.id,
        status: 'OPEN',
        ...(isAlertParam === 'true' ? { isAlert: true } : {}),
        ...(type ? { type } : {}),
      },
    });

    const sorted = [...insights].sort((a, b) => {
      const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (byPriority !== 0) return byPriority;

      const aDue = a.dueDate ? a.dueDate.getTime() : Number.POSITIVE_INFINITY;
      const bDue = b.dueDate ? b.dueDate.getTime() : Number.POSITIVE_INFINITY;
      if (aDue === bDue) return 0;
      return aDue < bDue ? -1 : 1;
    });

    return NextResponse.json({ insights: sorted });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}