import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PRIORITIES = 5;
const NOTE_MAX_LENGTH = 280;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PRIORITY_ERROR = 'Choose a priority level (high, medium or low) for each selected task.';
const WEEK_ERROR = "Planned week must be a valid date for next week's start (Monday).";
const NOTE_ERROR = 'Priority note must be 280 characters or fewer.';
const GOAL_ERROR = 'Select an active goal from the list, or leave the goal empty.';

type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH';

const PRIORITY_MAP: Record<string, PriorityLevel | undefined> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
};

interface PriorityEntry {
  taskId: string;
  priority: PriorityLevel;
  note: string | null;
}

function parseDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

function localDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (dbUser.role !== 'FREELANCE_VIDEO_EDITOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { week_start: weekStartInput, priorities } = body as Record<string, unknown>;

  if (typeof weekStartInput !== 'string') {
    return NextResponse.json({ error: WEEK_ERROR }, { status: 400 });
  }
  const weekStart = parseDay(weekStartInput);
  if (!weekStart || weekStart.getUTCDay() !== 1) {
    return NextResponse.json({ error: WEEK_ERROR }, { status: 400 });
  }

  const todayParam = new URL(request.url).searchParams.get('date');
  const todayDay = todayParam && parseDay(todayParam) ? todayParam : localDay(new Date());
  const today = new Date(`${todayDay}T00:00:00Z`);
  const daysSinceMonday = (today.getUTCDay() + 6) % 7;
  const nextMonday = new Date(today.getTime() - daysSinceMonday * DAY_MS + 7 * DAY_MS);
  if (weekStart.getTime() !== nextMonday.getTime()) {
    return NextResponse.json({ error: WEEK_ERROR }, { status: 400 });
  }

  if (!Array.isArray(priorities) || priorities.length === 0) {
    return NextResponse.json(
      { error: 'Choose at least one task as a priority for next week.' },
      { status: 400 },
    );
  }
  if (priorities.length > MAX_PRIORITIES) {
    return NextResponse.json(
      { error: `You can choose at most ${MAX_PRIORITIES} priorities for next week.` },
      { status: 400 },
    );
  }

  const entries: PriorityEntry[] = [];
  const seen = new Set<string>();

  for (const item of priorities) {
    if (!item || typeof item !== 'object') {
      return NextResponse.json({ error: 'Invalid priority entry.' }, { status: 400 });
    }
    const { task_id: taskId, priority, priority_note: rawNote } = item as Record<string, unknown>;

    if (typeof taskId !== 'string' || !UUID_PATTERN.test(taskId)) {
      return NextResponse.json({ error: 'Invalid task id.' }, { status: 400 });
    }
    if (seen.has(taskId)) {
      return NextResponse.json(
        { error: 'Each task can be chosen only once.' },
        { status: 400 },
      );
    }
    seen.add(taskId);

    const level = typeof priority === 'string' ? PRIORITY_MAP[priority.toLowerCase()] : undefined;
    if (!level) {
      return NextResponse.json({ error: PRIORITY_ERROR }, { status: 400 });
    }

    let note: string | null = null;
    if (rawNote !== undefined && rawNote !== null) {
      if (typeof rawNote !== 'string') {
        return NextResponse.json({ error: NOTE_ERROR }, { status: 400 });
      }
      const trimmed = rawNote.trim();
      if (trimmed.length > NOTE_MAX_LENGTH) {
        return NextResponse.json({ error: NOTE_ERROR }, { status: 400 });
      }
      note = trimmed.length > 0 ? trimmed : null;
    }

    entries.push({ taskId, priority: level, note });
  }

  try {
    const taskIds = entries.map((entry) => entry.taskId);

    const tasks = await prisma.task.findMany({
      where: { id: { in: taskIds }, userId: user.id },
      select: { id: true, status: true, goalId: true },
    });

    if (tasks.length !== taskIds.length) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (tasks.some((task) => task.status !== 'OPEN')) {
      return NextResponse.json(
        { error: 'Only open tasks can be set as next-week priorities.' },
        { status: 409 },
      );
    }

    const goalIds = tasks
      .map((task) => task.goalId)
      .filter((goalId): goalId is string => typeof goalId === 'string' && goalId.length > 0);

    if (goalIds.length > 0) {
      const activeGoals = await prisma.goal.findMany({
        where: { id: { in: goalIds }, status: 'ACTIVE' },
        select: { id: true },
      });
      const activeGoalIds = new Set(activeGoals.map((goal) => goal.id));
      if (goalIds.some((goalId) => !activeGoalIds.has(goalId))) {
        return NextResponse.json({ error: GOAL_ERROR }, { status: 400 });
      }
    }

    const updated = await prisma.$transaction(
      entries.map((entry) =>
        prisma.task.update({
          where: { id: entry.taskId },
          data: {
            plannedWeekStart: weekStart,
            priority: entry.priority,
            priorityNote: entry.note,
          },
        }),
      ),
    );

    return NextResponse.json({ tasks: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}