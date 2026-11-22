import { NextResponse } from 'next/server';
import { GoalStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const DAY_MS = 24 * 60 * 60 * 1000;

function resolveToday(request: Request): Date {
  const day = new URL(request.url).searchParams.get('date');
  const iso = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : new Date().toISOString().slice(0, 10);
  return new Date(`${iso}T00:00:00Z`);
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    if (user instanceof Response) return user;

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (dbUser.role !== Role.FREELANCE_VIDEO_EDITOR) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const today = resolveToday(request);

    const goals = await prisma.goal.findMany({
      where: { userId: user.id },
      orderBy: { periodStart: 'asc' },
    });

    const result = await Promise.all(
      goals.map(async (goal) => {
        const endExclusive = new Date(goal.periodEnd.getTime() + DAY_MS);
        const completedCount = await prisma.project.count({
          where: {
            businessId: goal.businessId,
            status: 'COMPLETED',
            completedAt: {
              gte: goal.periodStart,
              lt: endExclusive,
            },
          },
        });

        let status: GoalStatus = GoalStatus.ACTIVE;
        if (completedCount >= goal.targetProjectCount) {
          status = GoalStatus.ACHIEVED;
        } else if (goal.periodEnd.getTime() < today.getTime()) {
          status = GoalStatus.MISSED;
        }

        return {
          ...goal,
          completedCount,
          status,
        };
      }),
    );

    return NextResponse.json({ goals: result });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}