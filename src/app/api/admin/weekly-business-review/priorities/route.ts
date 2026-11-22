import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PRIORITIES = 5;
const MAX_NOTE_LENGTH = 280;
const OWNER_ROLE = 'SMALL_VIDEO_EDITING_BUSINESS_OWNER';

const PRIORITY_LEVELS = new Map<string, 'HIGH' | 'MEDIUM' | 'LOW'>([
  ['high', 'HIGH'],
  ['medium', 'MEDIUM'],
  ['low', 'LOW'],
]);

type PriorityItem = {
  task_id?: unknown;
  priority?: unknown;
  priority_note?: unknown;
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function isDayString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function toDayString(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function todayFor(request: Request): string {
  const param = new URL(request.url).searchParams.get('date');
  if (isDayString(param)) return param;
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function nextWeekMonday(today: string): string {
  const base = new Date(`${today}T00:00:00Z`);
  const daysSinceMonday = (base.getUTCDay() + 6) % 7;
  const thisMonday = base.getTime() - daysSinceMonday * DAY_MS;
  return toDayString(new Date(thisMonday + 7 * DAY_MS));
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (String(user.role) !== OWNER_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const payload = (body ?? {}) as { week_start?: unknown; priorities?: unknown };

  const today = todayFor(request);
  const expectedWeekStart = nextWeekMonday(today);
  if (
    !isDayString(payload.week_start) ||
    payload.week_start !== expectedWeekStart
  ) {
    return NextResponse.json(
      { error: "Planned week must be a valid date for next week's start (Monday)." },
      { status: 400 }
    );
  }

  if (!Array.isArray(payload.priorities) || payload.priorities.length === 0) {
    return NextResponse.json(
      { error: 'Choose at least one task to prioritize.' },
      { status: 400 }
    );
  }

  if (payload.priorities.length > MAX_PRIORITIES) {
    return NextResponse.json(
      { error: `You can prioritize at most ${MAX_PRIORITIES} tasks for next week.` },
      { status: 400 }
    );
  }

  const items: { taskId: string; priority: 'HIGH' | 'MEDIUM' | 'LOW'; note: string | null }[] = [];
  const seen = new Set<string>();

  for (const raw of payload.priorities as PriorityItem[]) {
    const taskId = typeof raw?.task_id === 'string' ? raw.task_id.trim() : '';
    if (!taskId) {
      return NextResponse.json({ error: 'Each priority needs a task_id.' }, { status: 400 });
    }
    if (seen.has(taskId)) {
      return NextResponse.json(
        { error: 'Each task can be selected only once.' },
        { status: 400 }
      );
    }
    seen.add(taskId);

    const priority =
      typeof raw.priority === 'string' ? PRIORITY_LEVELS.get(raw.priority.toLowerCase()) : undefined;
    if (!priority) {
      return NextResponse.json(
        { error: 'Choose a priority level (high, medium or low) for each selected task.' },
        { status: 400 }
      );
    }

    let note: string | null = null;
    if (raw.priority_note !== undefined && raw.priority_note !== null) {
      if (typeof raw.priority_note !== 'string') {
        return NextResponse.json(
          { error: 'Priority note must be 280 characters or fewer.' },
          { status: 400 }
        );
      }
      const trimmed = raw.priority_note.trim();
      if (trimmed.length > MAX_NOTE_LENGTH) {
        return NextResponse.json(
          { error: 'Priority note must be 280 characters or fewer.' },
          { status: 400 }
        );
      }
      note = trimmed.length > 0 ? trimmed : null;
    }

    items.push({ taskId, priority, note });
  }

  try {
    const business = await prisma.business.findFirst({
      where: {
        OR: [{ userId: user.id }, { members: { some: { id: user.id } } }],
      },
      select: { id: true },
    });

    const memberRows = business
      ? await prisma.user.findMany({
          where: { businessId: business.id },
          select: { id: true },
        })
      : [];
    const businessUserIds = Array.from(
      new Set<string>([user.id, ...memberRows.map((m) => m.id)])
    );

    const tasks = await prisma.task.findMany({
      where: {
        id: { in: items.map((i) => i.taskId) },
        userId: { in: businessUserIds },
      },
      select: { id: true, status: true },
    });
    const taskById = new Map(tasks.map((t) => [t.id, t]));

    for (const item of items) {
      const task = taskById.get(item.taskId);
      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      if (String(task.status) !== 'OPEN') {
        return NextResponse.json(
          { error: 'Only open tasks can be set as next-week priorities.' },
          { status: 400 }
        );
      }
    }

    const plannedWeekStart = new Date(`${payload.week_start}T00:00:00Z`);

    const updated = await prisma.$transaction(
      items.map((item) =>
        prisma.task.update({
          where: { id: item.taskId },
          data: {
            plannedWeekStart,
            priority: item.priority,
            priorityNote: item.note,
          },
        })
      )
    );

    return NextResponse.json({ tasks: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}