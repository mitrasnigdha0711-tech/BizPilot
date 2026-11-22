import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const MAX_ITEMS = 5;

const PRIORITY_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function priorityRank(priority: unknown): number {
  return PRIORITY_RANK[String(priority).toLowerCase()] ?? 3;
}

function dueTime(dueDate: Date | null | undefined): number {
  return dueDate ? new Date(dueDate).getTime() : Number.POSITIVE_INFINITY;
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
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    if (String(dbUser.role).toLowerCase() !== 'freelance_video_editor') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const candidates = await prisma.insight.findMany({
      where: {
        userId: user.id,
        type: 'NEXT_ACTION',
        status: 'OPEN',
        isStale: false,
      },
      take: 200,
    });

    const insights = [...candidates]
      .sort((a, b) => {
        const byPriority = priorityRank(a.priority) - priorityRank(b.priority);
        if (byPriority !== 0) return byPriority;
        return dueTime(a.dueDate) - dueTime(b.dueDate);
      })
      .slice(0, MAX_ITEMS);

    return NextResponse.json({ insights });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}