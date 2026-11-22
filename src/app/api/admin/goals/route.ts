import { NextResponse } from 'next/server';
import { GoalStatus, ProjectStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthBounds(month: string) {
  const [y, m] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1)),
    nextStart: new Date(Date.UTC(y, m, 1)),
    end: new Date(Date.UTC(y, m, 0)),
  };
}

function todayKeyFrom(request: Request): string {
  const param = new URL(request.url).searchParams.get('date');
  if (param && DAY_RE.test(param)) return param;
  return new Date().toLocaleDateString('en-CA');
}

function resolveStatus(target: number, completed: number, endKey: string, todayKey: string): GoalStatus {
  if (completed >= target) return GoalStatus.ACHIEVED;
  if (todayKey > endKey) return GoalStatus.MISSED;
  return GoalStatus.ACTIVE;
}

function progressPercent(completed: number, target: number): number {
  if (!target || target <= 0) return 0;
  return Math.round((completed / target) * 1000) / 10;
}

async function countCompleted(businessId: string, start: Date, nextStart: Date): Promise<number> {
  return prisma.project.count({
    where: {
      businessId,
      status: ProjectStatus.COMPLETED,
      completedAt: { gte: start, lt: nextStart },
    },
  });
}

async function resolveOwner(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, businessId: true },
  });
  if (!row) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  if (row.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!row.businessId) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }
  return { userId: user.id, businessId: row.businessId };
}

export async function GET(request: Request) {
  const actor = await resolveOwner(request);
  if (actor instanceof Response) return actor;

  try {
    const todayKey = todayKeyFrom(request);
    const goals = await prisma.goal.findMany({
      where: { businessId: actor.businessId },
      orderBy: { periodStart: 'desc' },
    });

    const rows = await Promise.all(
      goals.map(async (goal) => {
        const { start, nextStart } = monthBounds(dayKey(goal.periodStart).slice(0, 7));
        const completedCount = await countCompleted(actor.businessId, start, nextStart);
        const status = resolveStatus(
          goal.targetProjectCount,
          completedCount,
          dayKey(goal.periodEnd),
          todayKey,
        );
        return {
          goal: {
            ...goal,
            periodStart: dayKey(goal.periodStart),
            periodEnd: dayKey(goal.periodEnd),
            completedCount,
            status,
          },
          completedCount,
          progressPercent: progressPercent(completedCount, goal.targetProjectCount),
        };
      }),
    );

    return NextResponse.json({ goals: rows });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await resolveOwner(request);
  if (actor instanceof Response) return actor;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const input = (body ?? {}) as Record<string, unknown>;

  const month = typeof input.month === 'string' ? input.month : '';
  if (!MONTH_RE.test(month)) {
    return NextResponse.json({ error: 'Select a valid month for this goal.' }, { status: 400 });
  }

  try {
    const business = await prisma.business.findUnique({
      where: { id: actor.businessId },
      select: { monthlyProjectTarget: true },
    });
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const rawTarget = input.targetProjectCount ?? business.monthlyProjectTarget;
    if (typeof rawTarget !== 'number' || !Number.isInteger(rawTarget) || rawTarget < 1 || rawTarget > 50) {
      return NextResponse.json(
        { error: 'Enter a whole number of projects between 1 and 50.' },
        { status: 400 },
      );
    }
    const targetProjectCount = rawTarget;

    const title =
      typeof input.title === 'string' && input.title.trim() !== ''
        ? input.title.trim()
        : `Goal for ${month}`;

    const { start, nextStart, end } = monthBounds(month);
    const endKey = dayKey(end);
    const todayKey = todayKeyFrom(request);

    if (todayKey > endKey) {
      return NextResponse.json(
        { error: 'This month has ended and its goal is read-only.' },
        { status: 409 },
      );
    }

    const existing = await prisma.goal.findFirst({
      where: { businessId: actor.businessId, periodStart: start },
    });

    const completedCount = await countCompleted(actor.businessId, start, nextStart);
    const status = resolveStatus(targetProjectCount, completedCount, endKey, todayKey);

    const goal = existing
      ? await prisma.goal.update({
          where: { id: existing.id },
          data: { title, targetProjectCount, completedCount, status },
        })
      : await prisma.goal.create({
          data: {
            title,
            periodStart: start,
            periodEnd: end,
            targetProjectCount,
            completedCount,
            status,
            businessId: actor.businessId,
            userId: actor.userId,
          },
        });

    return NextResponse.json(
      {
        goal: {
          ...goal,
          periodStart: dayKey(goal.periodStart),
          periodEnd: dayKey(goal.periodEnd),
          completedCount,
          status,
        },
      },
      { status: existing ? 200 : 201 },
    );
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}