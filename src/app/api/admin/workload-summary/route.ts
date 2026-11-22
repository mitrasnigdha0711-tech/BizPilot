import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OWNER_ROLE = 'small_video_editing_business_owner';

function toDay(ymd: string): Date {
  return new Date(`${ymd}T00:00:00Z`);
}

function fmtDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

function mondayOf(d: Date): Date {
  const diff = (d.getUTCDay() + 6) % 7;
  return addDays(d, -diff);
}

function parseMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (String(user.role).toLowerCase() !== OWNER_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);

  const parsedWeeks = Number.parseInt(url.searchParams.get('weeks') ?? '4', 10);
  const weeks = Number.isFinite(parsedWeeks) ? Math.min(Math.max(parsedWeeks, 1), 26) : 4;

  const weekStartParam = url.searchParams.get('week_start');
  let weekStart: Date;
  if (weekStartParam) {
    if (!DATE_RE.test(weekStartParam)) {
      return NextResponse.json({ error: 'week_start must be YYYY-MM-DD' }, { status: 400 });
    }
    weekStart = toDay(weekStartParam);
    if (Number.isNaN(weekStart.getTime())) {
      return NextResponse.json({ error: 'week_start is not a valid date' }, { status: 400 });
    }
  } else {
    const today = new Date().toLocaleDateString('en-CA');
    weekStart = mondayOf(toDay(today));
  }

  const rangeEnd = addDays(weekStart, weeks * 7);

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { businessId: true },
    });

    const business = await prisma.business.findFirst({
      where: {
        OR: [
          { userId: user.id },
          ...(dbUser?.businessId ? [{ id: dbUser.businessId }] : []),
        ],
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const startMin = parseMinutes(business.workingHoursStart);
    const endMin = parseMinutes(business.workingHoursEnd);
    const capacityHours =
      startMin !== null && endMin !== null && endMin > startMin
        ? ((endMin - startMin) / 60) * 5
        : 0;

    const weeklyCapacity = business.monthlyProjectTarget / 4.33;

    const members = await prisma.user.findMany({
      where: { businessId: business.id },
      select: { id: true },
    });
    const memberIds = Array.from(new Set([business.userId, ...members.map((m) => m.id)]));

    const projects = await prisma.project.findMany({
      where: {
        businessId: business.id,
        status: 'IN_PROGRESS',
        deadline: { gte: weekStart, lt: rangeEnd },
      },
      select: { deadline: true },
    });

    const tasks = await prisma.task.findMany({
      where: {
        status: 'OPEN',
        dueDate: { gte: weekStart, lt: rangeEnd },
        OR: [{ userId: { in: memberIds } }, { assigneeId: { in: memberIds } }],
      },
      select: { dueDate: true },
    });

    const projectCounts: number[] = Array.from({ length: weeks }, () => 0);
    const taskCounts: number[] = Array.from({ length: weeks }, () => 0);

    const weekIndex = (d: Date): number =>
      Math.floor((d.getTime() - weekStart.getTime()) / WEEK_MS);

    for (const p of projects) {
      const idx = weekIndex(p.deadline);
      if (idx >= 0 && idx < weeks) projectCounts[idx] += 1;
    }

    for (const t of tasks) {
      if (!t.dueDate) continue;
      const idx = weekIndex(t.dueDate);
      if (idx >= 0 && idx < weeks) taskCounts[idx] += 1;
    }

    const workloadSummary = Array.from({ length: weeks }, (_, i) => {
      const activeProjectCount = projectCounts[i];
      const openTaskCount = taskCounts[i];
      const workloadPercent =
        weeklyCapacity > 0
          ? round2((activeProjectCount + openTaskCount) / weeklyCapacity)
          : 0;

      return {
        week_start: fmtDay(addDays(weekStart, i * 7)),
        workload_percent: workloadPercent,
        capacity_hours: round2(capacityHours),
        open_task_count: openTaskCount,
        active_project_count: activeProjectCount,
      };
    });

    return NextResponse.json({ workloadSummary });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}