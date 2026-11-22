import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;
const OWNER_ROLE = 'SMALL_VIDEO_EDITING_BUSINESS_OWNER';

type CalendarItem = {
  kind: string;
  id: string;
  title: string;
  date: string;
  status: string;
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** The server's local calendar day as YYYY-MM-DD (used only when no date is given). */
function localTodayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses YYYY-MM-DD into a UTC-midnight Date, or null when invalid. */
function parseDay(value: string): Date | null {
  if (!DAY_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  if (d.toISOString().slice(0, 10) !== value) return null;
  return d;
}

function formatDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const caller = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, businessId: true },
    });
    if (!caller) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }
    if (caller.role !== OWNER_ROLE) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const todayKey = localTodayKey();
    const today = parseDay(todayKey);
    if (!today) {
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }

    const fromParam = url.searchParams.get('from') ?? todayKey;
    const from = parseDay(fromParam);
    if (!from) {
      return NextResponse.json({ error: 'Invalid from date' }, { status: 400 });
    }

    const toParam = url.searchParams.get('to') ?? fromParam;
    const to = parseDay(toParam);
    if (!to) {
      return NextResponse.json({ error: 'Invalid to date' }, { status: 400 });
    }
    if (to.getTime() < from.getTime()) {
      return NextResponse.json(
        { error: 'End date must be on or after start date' },
        { status: 400 },
      );
    }
    if ((to.getTime() - from.getTime()) / DAY_MS > MAX_RANGE_DAYS) {
      return NextResponse.json(
        { error: `Date range must be ${MAX_RANGE_DAYS} days or fewer` },
        { status: 400 },
      );
    }

    const endExclusive = new Date(to.getTime() + DAY_MS);

    let businessId = caller.businessId;
    if (!businessId) {
      const owned = await prisma.business.findFirst({
        where: { userId: user.id },
        select: { id: true },
      });
      businessId = owned?.id ?? null;
    }
    if (!businessId) {
      return NextResponse.json({ calendar: [] satisfies CalendarItem[] });
    }

    const members = await prisma.user.findMany({
      where: { businessId },
      select: { id: true },
    });
    const memberIds = Array.from(new Set([user.id, ...members.map((m) => m.id)]));

    const includesToday = from.getTime() <= today.getTime() && today.getTime() <= to.getTime();

    const [tasks, overdueFollowUps, projects, bills, invoices] = await Promise.all([
      prisma.task.findMany({
        where: {
          userId: { in: memberIds },
          dueDate: { gte: from, lt: endExclusive },
        },
        orderBy: { dueDate: 'asc' },
      }),
      includesToday
        ? prisma.task.findMany({
            where: {
              userId: { in: memberIds },
              type: 'FOLLOW_UP',
              status: 'OPEN',
              dueDate: { lt: from },
            },
            orderBy: { dueDate: 'asc' },
          })
        : Promise.resolve([]),
      prisma.project.findMany({
        where: {
          businessId,
          deadline: { gte: from, lt: endExclusive },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        orderBy: { deadline: 'asc' },
      }),
      prisma.recurringBill.findMany({
        where: {
          businessId,
          status: 'ACTIVE',
          nextDueDate: { gte: from, lt: endExclusive },
        },
        orderBy: { nextDueDate: 'asc' },
      }),
      prisma.invoice.findMany({
        where: {
          businessId,
          balanceDue: { gt: 0 },
          dueDate: { gte: from, lt: endExclusive },
          status: { notIn: ['DRAFT', 'PAID'] },
        },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    const items: CalendarItem[] = [];

    for (const t of tasks) {
      if (!t.dueDate) continue;
      const isOpen = t.status === 'OPEN';
      const isLate = isOpen && t.dueDate.getTime() < today.getTime();
      items.push({
        kind: t.type === 'FOLLOW_UP' ? 'follow_up' : 'task',
        id: t.id,
        title: t.title,
        date: formatDay(t.dueDate),
        status: !isOpen ? 'completed' : isLate ? 'overdue' : 'open',
      });
    }

    for (const t of overdueFollowUps) {
      if (!t.dueDate) continue;
      items.push({
        kind: 'follow_up',
        id: t.id,
        title: t.title,
        date: todayKey,
        status: 'overdue',
      });
    }

    for (const p of projects) {
      items.push({
        kind: 'project_deadline',
        id: p.id,
        title: p.name,
        date: formatDay(p.deadline),
        status: p.status.toLowerCase(),
      });
    }

    for (const b of bills) {
      items.push({
        kind: 'recurring_bill',
        id: b.id,
        title: b.name,
        date: formatDay(b.nextDueDate),
        status: b.status.toLowerCase(),
      });
    }

    for (const inv of invoices) {
      const isLate = inv.dueDate.getTime() < today.getTime();
      items.push({
        kind: 'invoice_due',
        id: inv.id,
        title: `Invoice ${inv.invoiceNumber}`,
        date: formatDay(inv.dueDate),
        status: isLate ? 'overdue' : inv.status.toLowerCase(),
      });
    }

    items.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
      return a.title.localeCompare(b.title);
    });

    return NextResponse.json({ calendar: items });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}