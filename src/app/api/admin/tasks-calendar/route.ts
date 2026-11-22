import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const OWNER_ROLE = 'small_video_editing_business_owner';
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

type CalendarItem = {
  date: string;
  kind: string;
  title: string;
  id: string;
  assigneeId: string | null;
};

function parseDay(value: string): Date | null {
  if (!DAY_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function todayLocal(): string {
  return new Date().toLocaleDateString('en-CA');
}

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const role = String(user.role ?? '').toLowerCase();
  if (role !== OWNER_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const fromParam = params.get('from') ?? todayLocal();
  const fromDate = parseDay(fromParam);
  if (!fromDate) {
    return NextResponse.json({ error: 'from must be a valid YYYY-MM-DD date' }, { status: 400 });
  }

  const toParam = params.get('to');
  const toDate = toParam === null ? new Date(fromDate.getTime() + 6 * DAY_MS) : parseDay(toParam);
  if (!toDate) {
    return NextResponse.json({ error: 'to must be a valid YYYY-MM-DD date' }, { status: 400 });
  }

  if (toDate.getTime() < fromDate.getTime()) {
    return NextResponse.json({ error: 'to must be on or after from' }, { status: 400 });
  }

  const rangeDays = Math.round((toDate.getTime() - fromDate.getTime()) / DAY_MS) + 1;
  if (rangeDays > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: `Date range must be ${MAX_RANGE_DAYS} days or fewer` }, { status: 400 });
  }

  try {
    const owner = await prisma.user.findUnique({
      where: { id: user.id },
      select: { businessId: true },
    });

    if (!owner?.businessId) {
      return NextResponse.json({ calendarItems: [] });
    }

    const businessId = owner.businessId;
    const range = { gte: fromDate, lte: toDate };

    const [tasks, projects, bills, invoices] = await Promise.all([
      prisma.task.findMany({
        where: {
          status: 'OPEN',
          dueDate: range,
          user: { businessId },
        },
        select: { id: true, title: true, type: true, dueDate: true, assigneeId: true },
      }),
      prisma.project.findMany({
        where: {
          businessId,
          deadline: range,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        select: { id: true, name: true, deadline: true },
      }),
      prisma.recurringBill.findMany({
        where: {
          businessId,
          status: 'ACTIVE',
          nextDueDate: range,
        },
        select: { id: true, name: true, nextDueDate: true },
      }),
      prisma.invoice.findMany({
        where: {
          businessId,
          dueDate: range,
          balanceDue: { gt: 0 },
          status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
        select: { id: true, invoiceNumber: true, dueDate: true },
      }),
    ]);

    const items: CalendarItem[] = [];

    for (const task of tasks) {
      if (!task.dueDate) continue;
      items.push({
        date: toDay(task.dueDate),
        kind: task.type === 'FOLLOW_UP' ? 'follow_up' : 'task',
        title: task.title,
        id: task.id,
        assigneeId: task.assigneeId ?? null,
      });
    }

    for (const project of projects) {
      items.push({
        date: toDay(project.deadline),
        kind: 'project_deadline',
        title: project.name,
        id: project.id,
        assigneeId: null,
      });
    }

    for (const bill of bills) {
      items.push({
        date: toDay(bill.nextDueDate),
        kind: 'recurring_bill',
        title: bill.name,
        id: bill.id,
        assigneeId: null,
      });
    }

    for (const invoice of invoices) {
      if (!invoice.dueDate) continue;
      items.push({
        date: toDay(invoice.dueDate),
        kind: 'invoice_due',
        title: `Invoice ${invoice.invoiceNumber} due`,
        id: invoice.id,
        assigneeId: null,
      });
    }

    items.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
      return a.title.localeCompare(b.title);
    });

    return NextResponse.json({ calendarItems: items });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}