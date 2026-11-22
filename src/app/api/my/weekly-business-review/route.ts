import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, isActive: true },
    });

    if (!me || !me.isActive) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (me.role !== 'FREELANCE_VIDEO_EDITOR') {
      return NextResponse.json(
        { error: 'Not available for your role' },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const requestedDay =
      url.searchParams.get('week_start') ?? new Date().toLocaleDateString('en-CA');

    if (!DATE_RE.test(requestedDay)) {
      return NextResponse.json(
        { error: 'week_start must be YYYY-MM-DD' },
        { status: 400 },
      );
    }

    const weekStart = new Date(`${requestedDay}T00:00:00Z`);
    if (Number.isNaN(weekStart.getTime())) {
      return NextResponse.json({ error: 'Invalid week_start date' }, { status: 400 });
    }

    // Window is [weekStart, weekEnd): seven days starting at week_start.
    const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);
    const weekStartDay = weekStart.toISOString().slice(0, 10);

    const [completedProjects, receivedPayments, expenses, overdueCount, goals, priorities] =
      await Promise.all([
        prisma.project.findMany({
          where: {
            userId: user.id,
            status: 'COMPLETED',
            completedAt: { gte: weekStart, lt: weekEnd },
          },
          orderBy: { completedAt: 'asc' },
        }),
        prisma.payment.findMany({
          where: {
            userId: user.id,
            receivedAt: { gte: weekStart, lt: weekEnd },
          },
          select: { amount: true },
        }),
        prisma.expens.findMany({
          where: {
            userId: user.id,
            expenseDate: { gte: weekStart, lt: weekEnd },
          },
          select: { amount: true },
        }),
        prisma.invoice.count({
          where: {
            userId: user.id,
            status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
            balanceDue: { gt: 0 },
            dueDate: { lt: weekEnd },
          },
        }),
        prisma.goal.findMany({
          where: {
            userId: user.id,
            periodStart: { lte: weekEnd },
            periodEnd: { gte: weekStart },
          },
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            targetProjectCount: true,
          },
        }),
        prisma.task.findMany({
          where: {
            userId: user.id,
            status: 'OPEN',
            plannedWeekStart: weekStart,
          },
          orderBy: { dueDate: 'asc' },
        }),
      ]);

    const paymentsCollected = round2(
      receivedPayments.reduce((sum, p) => sum + Number(p.amount), 0),
    );
    const expensesTotal = round2(
      expenses.reduce((sum, e) => sum + Number(e.amount), 0),
    );

    const goalProgress = await Promise.all(
      goals.map(async (goal) => {
        const completedCount = await prisma.project.count({
          where: {
            userId: user.id,
            status: 'COMPLETED',
            completedAt: { gte: goal.periodStart, lte: goal.periodEnd },
          },
        });
        const target = goal.targetProjectCount;
        if (!target || target <= 0) return 0;
        return Math.min(100, round1((completedCount / target) * 100));
      }),
    );

    return NextResponse.json({
      week_start: weekStartDay,
      completed_projects: completedProjects,
      payments_collected: paymentsCollected,
      expenses_total: expensesTotal,
      overdue_invoices: overdueCount,
      goal_progress: goalProgress,
      priorities,
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}