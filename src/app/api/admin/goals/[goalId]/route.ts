import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (d.toISOString().slice(0, 10) !== value) return null;
  return d;
}

function todayDay(): Date {
  const key = new Date().toLocaleDateString('en-CA');
  return new Date(`${key}T00:00:00Z`);
}

async function resolveOwner(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, businessId: true },
  });
  if (!me) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (me.role !== 'SMALL_VIDEO_EDITING_BUSINESS_OWNER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!me.businessId) {
    return NextResponse.json({ error: 'Business setup required' }, { status: 409 });
  }
  return { userId: user.id, businessId: me.businessId };
}

async function countCompletedInPeriod(
  businessId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<number> {
  const endExclusive = new Date(periodEnd.getTime() + DAY_MS);
  return prisma.project.count({
    where: {
      businessId,
      status: 'COMPLETED',
      completedAt: { gte: periodStart, lt: endExclusive },
    },
  });
}

function computeStatus(
  completedCount: number,
  target: number,
  periodEnd: Date,
  today: Date,
): 'ACTIVE' | 'ACHIEVED' | 'MISSED' {
  if (completedCount >= target) return 'ACHIEVED';
  if (periodEnd.getTime() < today.getTime()) return 'MISSED';
  return 'ACTIVE';
}

export async function PATCH(
  request: Request,
  { params }: { params: { goalId: string } },
) {
  try {
    const owner = await resolveOwner(request);
    if (owner instanceof Response) return owner;

    const { goalId } = params;
    if (!UUID_RE.test(goalId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;

    const data: {
      title?: string;
      periodStart?: Date;
      periodEnd?: Date;
      targetProjectCount?: number;
    } = {};

    if (input.title !== undefined) {
      if (typeof input.title !== 'string' || input.title.trim().length === 0 || input.title.trim().length > 120) {
        return NextResponse.json({ error: 'Enter a goal title up to 120 characters.' }, { status: 400 });
      }
      data.title = input.title.trim();
    }

    if (input.targetProjectCount !== undefined) {
      const t = input.targetProjectCount;
      if (typeof t !== 'number' || !Number.isInteger(t) || t < 1 || t > 50) {
        return NextResponse.json(
          { error: 'Enter a whole number of projects between 1 and 50.' },
          { status: 400 },
        );
      }
      data.targetProjectCount = t;
    }

    if (input.periodStart !== undefined) {
      const d = parseDay(input.periodStart);
      if (!d) {
        return NextResponse.json({ error: 'Select a valid month for this goal.' }, { status: 400 });
      }
      data.periodStart = d;
    }

    if (input.periodEnd !== undefined) {
      const d = parseDay(input.periodEnd);
      if (!d) {
        return NextResponse.json({ error: 'Select a valid month for this goal.' }, { status: 400 });
      }
      data.periodEnd = d;
    }

    const existing = await prisma.goal.findFirst({
      where: { id: goalId, businessId: owner.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const today = todayDay();
    if (existing.periodEnd.getTime() < today.getTime()) {
      return NextResponse.json(
        { error: 'Past goals are read-only' },
        { status: 409 },
      );
    }

    const periodStart = data.periodStart ?? existing.periodStart;
    const periodEnd = data.periodEnd ?? existing.periodEnd;
    if (periodEnd.getTime() <= periodStart.getTime()) {
      return NextResponse.json(
        { error: 'Period end must be after period start.' },
        { status: 400 },
      );
    }

    const monthChanged =
      periodStart.getUTCFullYear() !== existing.periodStart.getUTCFullYear() ||
      periodStart.getUTCMonth() !== existing.periodStart.getUTCMonth();

    if (monthChanged) {
      const monthStart = new Date(
        Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), 1),
      );
      const nextMonthStart = new Date(
        Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 1),
      );
      const clash = await prisma.goal.findFirst({
        where: {
          businessId: owner.businessId,
          id: { not: goalId },
          periodStart: { gte: monthStart, lt: nextMonthStart },
        },
        select: { id: true },
      });
      if (clash) {
        return NextResponse.json(
          { error: 'This business already has a goal for that month.' },
          { status: 409 },
        );
      }
    }

    const target = data.targetProjectCount ?? existing.targetProjectCount;
    const completedCount = await countCompletedInPeriod(
      owner.businessId,
      periodStart,
      periodEnd,
    );
    const status = computeStatus(completedCount, target, periodEnd, today);

    const goal = await prisma.goal.update({
      where: { id: goalId },
      data: {
        ...data,
        periodStart,
        periodEnd,
        targetProjectCount: target,
        completedCount,
        status,
      },
    });

    return NextResponse.json({ goal });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { goalId: string } },
) {
  try {
    const owner = await resolveOwner(request);
    if (owner instanceof Response) return owner;

    const { goalId } = params;
    if (!UUID_RE.test(goalId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const existing = await prisma.goal.findFirst({
      where: { id: goalId, businessId: owner.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (existing.periodEnd.getTime() < todayDay().getTime()) {
      return NextResponse.json(
        { error: 'Past goals are read-only' },
        { status: 409 },
      );
    }

    await prisma.$transaction([
      prisma.task.updateMany({
        where: { goalId },
        data: { goalId: null },
      }),
      prisma.goal.delete({ where: { id: goalId } }),
    ]);

    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}