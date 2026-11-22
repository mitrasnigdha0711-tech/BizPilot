import { NextResponse } from 'next/server';
import { Role, TaskStatus, ProjectStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

function localDay(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function parseHours(hhmm: string): number | null {
  const m = TIME_RE.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) + Number(m[2]) / 60;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, businessId: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (dbUser.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const dayParam = new URL(request.url).searchParams.get('date');
    if (dayParam !== null && !DATE_RE.test(dayParam)) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }
    const day = dayParam ?? localDay();
    const dayDate = dayToDate(day);

    const business = await prisma.business.findFirst({
      where: {
        OR: [
          { userId: user.id },
          ...(dbUser.businessId ? [{ id: dbUser.businessId }] : []),
        ],
      },
    });
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Current goal period: the goal whose period contains the day, else the calendar month.
    const goal = await prisma.goal.findFirst({
      where: {
        businessId: business.id,
        periodStart: { lte: dayDate },
        periodEnd: { gte: dayDate },
      },
      orderBy: { periodStart: 'desc' },
    });

    let periodStart: Date;
    let periodEnd: Date;
    if (goal) {
      periodStart = goal.periodStart;
      periodEnd = goal.periodEnd;
    } else {
      const [y, m] = day.split('-').map(Number);
      periodStart = new Date(Date.UTC(y, m - 1, 1));
      periodEnd = new Date(Date.UTC(y, m, 0));
    }
    const periodEndExclusive = new Date(periodEnd.getTime() + DAY_MS);
    const days = Math.round((periodEnd.getTime() - periodStart.getTime()) / DAY_MS) + 1;
    const weeks = days / 7;

    const startHours = parseHours(business.workingHoursStart);
    const endHours = parseHours(business.workingHoursEnd);
    const dailyHours =
      startHours !== null && endHours !== null && endHours > startHours ? endHours - startHours : 0;
    const weeklyHours = dailyHours * 5;
    const capacityHours = weeklyHours * weeks;

    const members = await prisma.user.findMany({
      where: {
        OR: [{ businessId: business.id }, { id: business.userId }],
      },
      select: { id: true },
    });
    const memberIds = members.map((m) => m.id);

    const [openTasks, activeProjects] = await Promise.all([
      prisma.task.findMany({
        where: {
          status: TaskStatus.OPEN,
          OR: [{ userId: { in: memberIds } }, { assigneeId: { in: memberIds } }],
        },
        select: { userId: true, assigneeId: true, dueDate: true },
      }),
      prisma.project.findMany({
        where: {
          businessId: business.id,
          status: { in: [ProjectStatus.PLANNED, ProjectStatus.IN_PROGRESS] },
        },
        select: { userId: true },
      }),
    ]);

    const rows = new Map<
      string,
      { assignee_id: string; open_tasks: number; due_tasks: number; active_projects: number }
    >();
    for (const id of memberIds) {
      rows.set(id, { assignee_id: id, open_tasks: 0, due_tasks: 0, active_projects: 0 });
    }

    for (const task of openTasks) {
      const assignee = task.assigneeId ?? task.userId;
      const row = rows.get(assignee);
      if (!row) continue;
      row.open_tasks += 1;
      if (task.dueDate && task.dueDate >= periodStart && task.dueDate < periodEndExclusive) {
        row.due_tasks += 1;
      }
    }

    for (const project of activeProjects) {
      const row = rows.get(project.userId);
      if (row) row.active_projects += 1;
    }

    const workload = Array.from(rows.values()).map((row) => ({
      assignee_id: row.assignee_id,
      open_tasks: row.open_tasks,
      active_projects: row.active_projects,
      load_percent: capacityHours > 0 ? round2((row.due_tasks / capacityHours) * 100) : 0,
    }));

    return NextResponse.json({ workload });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}