import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseDay(value: string | null): Date | null {
  if (!value || !DAY_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayLocal(): Date {
  const local = new Date().toLocaleDateString('en-CA');
  return parseDay(local) ?? new Date(`${toDay(new Date())}T00:00:00Z`);
}

type CalendarEntry = {
  date: string;
  kind: 'task' | 'follow_up' | 'project_deadline' | 'recurring_bill';
  title: string;
  id: string;
};

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const role = String((user as { role?: unknown }).role ?? '').toLowerCase();
  if (role !== 'FREELANCE_VIDEO_EDITOR') {
    return NextResponse.json(
      { error: 'Not available for your role' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  const from = fromParam ? parseDay(fromParam) : todayLocal();
  if (!from) {
    return NextResponse.json(
      { error: 'from must be a valid date (YYYY-MM-DD)' },
      { status: 400 },
    );
  }

  const to = toParam
    ? parseDay(toParam)
    : new Date(from.getTime() + 6 * DAY_MS);
  if (!to) {
    return NextResponse.json(
      { error: 'to must be a valid date (YYYY-MM-DD)' },
      { status: 400 },
    );
  }

  if (to.getTime() < from.getTime()) {
    return NextResponse.json(
      { error: 'End date must be on or after the start date' },
      { status: 400 },
    );
  }

  const spanDays = Math.round((to.getTime() - from.getTime()) / DAY_MS);
  if (spanDays > MAX_RANGE_DAYS) {
    return NextResponse.json(
      { error: `Date range must be ${MAX_RANGE_DAYS} days or fewer` },
      { status: 400 },
    );
  }

  try {
    const [tasks, projects, bills] = await Promise.all([
      prisma.task.findMany({
        where: {
          userId: user.id,
          status: 'OPEN',
          dueDate: { gte: from, lte: to },
        },
        select: { id: true, title: true, dueDate: true, type: true },
      }),
      prisma.project.findMany({
        where: {
          userId: user.id,
          deadline: { gte: from, lte: to },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        select: { id: true, name: true, deadline: true },
      }),
      prisma.recurringBill.findMany({
        where: {
          userId: user.id,
          status: 'ACTIVE',
          nextDueDate: { gte: from, lte: to },
        },
        select: { id: true, name: true, nextDueDate: true },
      }),
    ]);

    const entries: CalendarEntry[] = [];

    for (const task of tasks) {
      if (!task.dueDate) continue;
      entries.push({
        date: toDay(task.dueDate),
        kind: task.type === 'FOLLOW_UP' ? 'follow_up' : 'task',
        title: task.title,
        id: task.id,
      });
    }

    for (const project of projects) {
      entries.push({
        date: toDay(project.deadline),
        kind: 'project_deadline',
        title: project.name,
        id: project.id,
      });
    }

    for (const bill of bills) {
      entries.push({
        date: toDay(bill.nextDueDate),
        kind: 'recurring_bill',
        title: bill.name,
        id: bill.id,
      });
    }

    entries.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
      return a.title.localeCompare(b.title);
    });

    return NextResponse.json({ calendar: entries });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}