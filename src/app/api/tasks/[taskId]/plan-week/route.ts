import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OWNER_ROLE = 'small_video_editing_business_owner';
const ALLOWED_ROLES = ['freelance_video_editor', OWNER_ROLE];

function localDayKey(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isValidCalendarDay(day: string): boolean {
  if (!DAY_RE.test(day)) return false;
  const parsed = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
}

export async function POST(request: NextRequest, { params }: { params: { taskId: string } }) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const weekStart =
    typeof body === 'object' && body !== null
      ? (body as { week_start?: unknown }).week_start
      : undefined;

  if (typeof weekStart !== 'string' || !isValidCalendarDay(weekStart)) {
    return NextResponse.json(
      { error: 'week_start must be a valid date (YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  const weekStartDate = new Date(`${weekStart}T00:00:00Z`);
  if (weekStartDate.getUTCDay() !== 1) {
    return NextResponse.json({ error: 'week_start must be a Monday' }, { status: 400 });
  }

  const requestDate = new URL(request.url).searchParams.get('date');
  const today =
    requestDate && isValidCalendarDay(requestDate) ? requestDate : localDayKey(new Date());
  if (weekStart <= today) {
    return NextResponse.json(
      { error: 'week_start must be a Monday after today' },
      { status: 400 }
    );
  }

  const taskId = params.taskId;
  if (!UUID_RE.test(taskId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { user: { select: { businessId: true } } },
    });

    if (!task) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let allowed = task.userId === user.id;

    if (!allowed && user.role === OWNER_ROLE) {
      const caller = await prisma.user.findUnique({
        where: { id: user.id },
        select: { businessId: true },
      });
      allowed = Boolean(
        caller?.businessId && task.user?.businessId && caller.businessId === task.user.businessId
      );
    }

    if (!allowed) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: { plannedWeekStart: weekStartDate },
    });

    return NextResponse.json({ task: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}