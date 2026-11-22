import { NextResponse } from 'next/server';
import { GoalStatus, ProjectStatus } from '@prisma/client';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

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

  try {
    const businessId =
      dbUser.businessId ??
      (
        await prisma.business.findFirst({
          where: { userId: user.id },
          select: { id: true },
        })
      )?.id;
    if (!businessId) {
      return NextResponse.json({ goals: [] });
    }

    const dateParam = new URL(request.url).searchParams.get('date');
    const today =
      dateParam && DAY_PATTERN.test(dateParam)
        ? dateParam
        : new Date().toLocaleDateString('en-CA');

    const goals = await prisma.goal.findMany({
      where: { businessId },
      orderBy: { periodStart: 'desc' },
    });

    const items = await Promise.all(
      goals.map(async (goal) => {
        const nextMonthStart = new Date(goal.periodEnd.getTime() + 24 * 60 * 60 * 1000);
        const completedCount = await prisma.project.count({
          where: {
            businessId,
            status: ProjectStatus.COMPLETED,
            completedAt: { gte: goal.periodStart, lt: nextMonthStart },
          },
        });

        const target = goal.targetProjectCount;
        const completionRate = target > 0 ? completedCount / target : 0;

        const periodEndDay = goal.periodEnd.toISOString().slice(0, 10);
        let status: 'achieved' | 'missed' | 'active';
        if (completedCount >= target) {
          status = 'achieved';
        } else if (today > periodEndDay) {
          status = 'missed';
        } else {
          status = 'active';
        }

        return {
          goal: {
            ...goal,
            completedCount,
            status,
          },
          completion_rate: completionRate,
        };
      }),
    );

    return NextResponse.json({ goals: items });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

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

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const body = parsed as Record<string, unknown>;

  // Month selection (YYYY-MM)
  const rawMonth =
    typeof body.month === 'string'
      ? body.month
      : typeof body.periodStart === 'string'
        ? body.periodStart.slice(0, 7)
        : '';
  if (!MONTH_PATTERN.test(rawMonth)) {
    return NextResponse.json(
      { error: 'Select a valid month for this goal.' },
      { status: 400 },
    );
  }
  const month = rawMonth;
  const [year, monthNumber] = month.split('-').map(Number);
  const periodStart = new Date(Date.UTC(year, monthNumber - 1, 1));
  const periodEnd = new Date(Date.UTC(year, monthNumber, 0));
  const nextMonthStart = new Date(Date.UTC(year, monthNumber, 1));

  // Target validation
  const rawTarget = body.targetProjectCount;
  if (rawTarget === undefined || rawTarget === null || rawTarget === '') {
    return NextResponse.json(
      { error: 'Enter a monthly project target to save your goal.' },
      { status: 400 },
    );
  }
  const target =
    typeof rawTarget === 'number'
      ? rawTarget
      : typeof rawTarget === 'string' && rawTarget.trim() !== ''
        ? Number(rawTarget)
        : Number.NaN;
  if (!Number.isInteger(target) || target < 1 || target > 50) {
    return NextResponse.json(
      { error: 'Enter a whole number of projects between 1 and 50.' },
      { status: 400 },
    );
  }

  // Past months are read-only
  const dateParam = new URL(request.url).searchParams.get('date');
  const today =
    dateParam && DAY_PATTERN.test(dateParam)
      ? dateParam
      : new Date().toLocaleDateString('en-CA');
  if (month < today.slice(0, 7)) {
    return NextResponse.json(
      { error: 'This month has already ended, so its goal cannot be changed.' },
      { status: 409 },
    );
  }

  const businessId =
    dbUser.businessId ??
    (
      await prisma.business.findFirst({
        where: { userId: user.id },
        select: { id: true },
      })
    )?.id;
  if (!businessId) {
    return NextResponse.json(
      { error: 'Set up your business before setting goals.' },
      { status: 400 },
    );
  }

  const title =
    typeof body.title === 'string' && body.title.trim() !== ''
      ? body.title.trim()
      : `Monthly goal ${month}`;

  try {
    const completedCount = await prisma.project.count({
      where: {
        businessId,
        status: ProjectStatus.COMPLETED,
        completedAt: { gte: periodStart, lt: nextMonthStart },
      },
    });
    const status =
      completedCount >= target ? GoalStatus.ACHIEVED : GoalStatus.ACTIVE;

    const existing = await prisma.goal.findFirst({
      where: { businessId, periodStart },
      select: { id: true },
    });

    if (existing) {
      const goal = await prisma.goal.update({
        where: { id: existing.id },
        data: {
          title,
          periodEnd,
          targetProjectCount: target,
          completedCount,
          status,
        },
      });
      return NextResponse.json({ goal }, { status: 200 });
    }

    const goal = await prisma.goal.create({
      data: {
        title,
        periodStart,
        periodEnd,
        targetProjectCount: target,
        completedCount,
        status,
        businessId,
        userId: user.id,
      },
    });
    return NextResponse.json({ goal }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}