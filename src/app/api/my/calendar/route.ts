import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_ROLES = new Set(['FREELANCE_VIDEO_EDITOR', 'freelance_video_editor']);
const UPCOMING_WINDOW_DAYS = 7;

type CalendarItem = {
  kind: string;
  id: string;
  title: string;
  date: string;
  status: string;
};

function isValidDay(day: string): boolean {
  if (!DAY_RE.test(day)) return false;
  const d = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === day;
}

function dayStart(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function addDays(day: string, n: number): string {
  const d = dayStart(day);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    if (user instanceof Response) return user;

    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    if (!me || !ALLOWED_ROLES.has(String(me.role))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const today = url.searchParams.get('date') ?? new Date().toLocaleDateString('en-CA');
    if (!isValidDay(today)) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }

    const from = url.searchParams.get('from') ?? today;
    const to = url.searchParams.get('to') ?? addDays(from, 30);
    if (!isValidDay(from) || !isValidDay(to)) {
      return NextResponse.json({ error: 'from and to must be YYYY-MM-DD dates' }, { status: 400 });
    }
    if (to < from) {
      return NextResponse.json({ error: 'End date must be on or after start date' }, { status: 400 });
    }

    const rangeStart = dayStart(from);
    const rangeEnd = dayStart(addDays(to, 1));
    const todayEnd = dayStart(addDays(today, 1));
    const upcomingEnd = addDays(today, UPCOMING_WINDOW_DAYS);

    const [tasks, projects, bills, invoices] = await Promise.all([
      prisma.task.findMany({
        where: {
          userId: user.id,
          completedAt: null,
          OR: [
            { dueDate: { gte: rangeStart, lt: rangeEnd } },
            { type: 'FOLLOW_UP', dueDate: { lt: todayEnd } },
          ],
        },
        select: { id: true, title: true, dueDate: true, type: true },
      }),
      prisma.project.findMany({
        where: {
          userId: user.id,
          deadline: { gte: rangeStart, lt: rangeEnd },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        select: { id: true, name: true, deadline: true, status: true },
      }),
      prisma.recurringBill.findMany({
        where: {
          userId: user.id,
          status: 'ACTIVE',
          nextDueDate: { gte: rangeStart, lt: rangeEnd },
        },
        select: { id: true, name: true, nextDueDate: true, status: true },
      }),
      prisma.invoice.findMany({
        where: {
          userId: user.id,
          status: { not: 'DRAFT' },
          balanceDue: { gt: 0 },
          dueDate: { gte: rangeStart, lt: rangeEnd },
        },
        select: { id: true, invoiceNumber: true, dueDate: true, status: true },
      }),
    ]);

    const items: CalendarItem[] = [];

    for (const t of tasks) {
      if (!t.dueDate) continue;
      const day = toDay(t.dueDate);
      const isFollowUp = t.type === 'FOLLOW_UP';
      items.push({
        kind: isFollowUp ? 'follow_up' : 'task',
        id: t.id,
        title: t.title,
        date: day,
        status: day < today ? 'overdue' : 'open',
      });
    }

    for (const p of projects) {
      items.push({
        kind: 'project_deadline',
        id: p.id,
        title: p.name,
        date: toDay(p.deadline),
        status: String(p.status).toLowerCase(),
      });
    }

    for (const b of bills) {
      const day = toDay(b.nextDueDate);
      items.push({
        kind: 'recurring_bill',
        id: b.id,
        title: b.name,
        date: day,
        status: day >= today && day <= upcomingEnd ? 'upcoming' : 'active',
      });
    }

    for (const inv of invoices) {
      const day = toDay(inv.dueDate);
      items.push({
        kind: 'invoice_due',
        id: inv.id,
        title: `Invoice ${inv.invoiceNumber}`,
        date: day,
        status: day < today ? 'overdue' : 'due',
      });
    }

    // Deduplicate by kind + id (a follow-up can match both range clauses).
    const seen = new Set<string>();
    const unique = items.filter((item) => {
      const key = `${item.kind}:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    unique.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
      return a.title.localeCompare(b.title);
    });

    return NextResponse.json({ calendar: unique });
  } catch (e) {
    console.error('GET /api/my/calendar failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}