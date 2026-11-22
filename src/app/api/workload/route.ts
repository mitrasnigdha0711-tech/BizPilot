import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

const OWNER_ROLE = 'small_video_editing_business_owner';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDay(day: string): boolean {
  if (!DATE_RE.test(day)) return false;
  const d = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

function monthRange(today: string): { from: string; to: string } {
  const [y, m] = today.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return {
    from: `${y}-${mm}-01`,
    to: `${y}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    if (user instanceof Response) return user;

    if (user.role !== OWNER_ROLE) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const fromParam = url.searchParams.get('from');
    const toParam = url.searchParams.get('to');

    const today = new Date().toLocaleDateString('en-CA');
    const defaults = monthRange(today);
    const from = fromParam ?? defaults.from;
    const to = toParam ?? defaults.to;

    if (!isValidDay(from) || !isValidDay(to)) {
      return NextResponse.json({ error: 'from and to must be YYYY-MM-DD dates' }, { status: 400 });
    }
    if (to < from) {
      return NextResponse.json({ error: 'to must not be before from' }, { status: 400 });
    }

    const fromDate = new Date(`${from}T00:00:00Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { businessId: true },
    });

    const business = dbUser?.businessId
      ? await prisma.business.findUnique({ where: { id: dbUser.businessId } })
      : await prisma.business.findFirst({ where: { userId: user.id } });

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const members = await prisma.user.findMany({
      where: { businessId: business.id },
      select: { id: true },
    });
    const memberIds = Array.from(new Set<string>([business.userId, ...members.map((m) => m.id)]));

    const openTasks = await prisma.task.findMany({
      where: {
        userId: { in: memberIds },
        status: 'OPEN',
        dueDate: { gte: fromDate, lte: toDate },
      },
      select: { assigneeId: true, userId: true },
    });

    const deadlineProjects = await prisma.project.findMany({
      where: {
        businessId: business.id,
        status: { in: ['PLANNED', 'IN_PROGRESS'] },
        deadline: { gte: fromDate, lte: toDate },
      },
      select: { userId: true },
    });

    const counts = new Map<string, { open: number; deadlines: number }>();
    const bump = (id: string, key: 'open' | 'deadlines') => {
      const entry = counts.get(id) ?? { open: 0, deadlines: 0 };
      entry[key] += 1;
      counts.set(id, entry);
    };

    for (const id of memberIds) counts.set(id, { open: 0, deadlines: 0 });
    for (const t of openTasks) bump(t.assigneeId ?? t.userId, 'open');
    for (const p of deadlineProjects) bump(p.userId, 'deadlines');

    const target = business.monthlyProjectTarget;

    const workload = Array.from(counts.entries()).map(([assigneeId, c]) => {
      const total = c.open + c.deadlines;
      const workloadPercent = target > 0 ? round1((total / target) * 100) : 0;
      return {
        assignee_id: assigneeId,
        open_task_count: c.open,
        project_deadline_count: c.deadlines,
        workload_percent: workloadPercent,
      };
    });

    return NextResponse.json({ workload });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}