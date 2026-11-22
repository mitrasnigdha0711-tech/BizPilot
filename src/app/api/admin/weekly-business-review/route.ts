import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const OWNER_ROLE = 'SMALL_VIDEO_EDITING_BUSINESS_OWNER';
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(input: string): Date | null {
  if (!DAY_RE.test(input)) return null;
  const d = new Date(`${input}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

function decimalToNumber(value: { toNumber(): number } | null | undefined): number {
  if (!value) return 0;
  const n = value.toNumber();
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const url = new URL(request.url);
  const raw =
    url.searchParams.get('week_start') ??
    url.searchParams.get('date') ??
    new Date().toLocaleDateString('en-CA');

  const weekStart = parseDay(raw);
  if (!weekStart) {
    return NextResponse.json(
      { error: 'week_start must be a valid YYYY-MM-DD date' },
      { status: 400 },
    );
  }

  try {
    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, businessId: true },
    });

    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (me.role !== OWNER_ROLE) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!me.businessId) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const businessId = me.businessId;
    const windowStart = weekStart;
    const windowEnd = addDays(weekStart, 7);

    const [clients, members] = await Promise.all([
      prisma.client.findMany({ where: { businessId }, select: { id: true } }),
      prisma.user.findMany({ where: { businessId }, select: { id: true } }),
    ]);
    const clientIds = clients.map((c) => c.id);
    const memberIds = members.map((m) => m.id);

    const [
      completedProjects,
      paymentsAgg,
      expensesAgg,
      overdueInvoices,
      priorities,
      goals,
    ] = await Promise.all([
      prisma.project.findMany({
        where: {
          businessId,
          status: 'COMPLETED',
          completedAt: { gte: windowStart, lt: windowEnd },
        },
        orderBy: { completedAt: 'asc' },
      }),
      prisma.payment.aggregate({
        where: {
          clientId: { in: clientIds },
          status: 'RECEIVED',
          receivedAt: { gte: windowStart, lt: windowEnd },
        },
        _sum: { amount: true },
      }),
      prisma.expens.aggregate({
        where: {
          businessId,
          expenseDate: { gte: windowStart, lt: windowEnd },
        },
        _sum: { amount: true },
      }),
      prisma.invoice.count({
        where: {
          businessId,
          dueDate: { lt: windowEnd },
          balanceDue: { gt: 0 },
          status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
        },
      }),
      prisma.task.findMany({
        where: {
          userId: { in: memberIds },
          status: 'OPEN',
          plannedWeekStart: windowStart,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.goal.findMany({
        where: {
          businessId,
          periodStart: { lt: windowEnd },
          periodEnd: { gte: windowStart },
        },
        orderBy: { periodStart: 'asc' },
      }),
    ]);

    const goalProgress = await Promise.all(
      goals.map(async (goal) => {
        const completed = await prisma.project.count({
          where: {
            businessId,
            status: 'COMPLETED',
            completedAt: {
              gte: goal.periodStart,
              lt: addDays(goal.periodEnd, 1),
            },
          },
        });
        const target = goal.targetProjectCount;
        if (!target || target <= 0) return 0;
        const pct = (completed / target) * 100;
        return Math.min(100, Math.round(pct * 10) / 10);
      }),
    );

    const review = {
      week_start: formatDay(weekStart),
      completed_projects: completedProjects,
      payments_collected: decimalToNumber(paymentsAgg._sum.amount),
      expenses_total: decimalToNumber(expensesAgg._sum.amount),
      overdue_invoices: overdueInvoices,
      goal_progress: goalProgress,
      priorities,
    };

    return NextResponse.json({ review });
  } catch (error) {
    console.error('GET /api/admin/weekly-business-review failed', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}