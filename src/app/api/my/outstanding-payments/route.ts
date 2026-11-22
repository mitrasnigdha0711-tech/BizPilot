import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OPEN_STATUSES = ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] as const;

function dayStart(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

function toDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (user.role !== 'FREELANCE_VIDEO_EDITOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const dateParam = new URL(request.url).searchParams.get('date');
  if (dateParam !== null && (!DATE_RE.test(dateParam) || Number.isNaN(dayStart(dateParam)))) {
    return NextResponse.json({ error: 'Invalid date, expected YYYY-MM-DD' }, { status: 400 });
  }
  const today = dateParam ?? new Date().toLocaleDateString('en-CA');
  const todayStart = dayStart(today);

  try {
    const invoices = await prisma.invoice.findMany({
      where: {
        userId: user.id,
        status: { in: [...OPEN_STATUSES] },
      },
      include: {
        client: { select: { id: true, name: true } },
        payments: {
          where: { status: 'RECEIVED' },
          select: { amount: true },
        },
      },
    });

    const rows = invoices
      .map((inv) => {
        const amount = inv.amount.toNumber();
        const received = inv.payments.reduce((sum, p) => sum + p.amount.toNumber(), 0);
        const balanceDue = roundMoney(amount - received);
        const dueDay = toDay(inv.dueDate);
        const daysOverdue = Math.round((todayStart - dayStart(dueDay)) / DAY_MS);
        return {
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          clientId: inv.client.id,
          clientName: inv.client.name,
          balanceDue,
          dueDate: dueDay,
          daysOverdue,
          status: inv.status.toLowerCase(),
        };
      })
      .filter((row) => row.balanceDue > 0)
      .sort((a, b) => {
        if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
        return b.balanceDue - a.balanceDue;
      });

    return NextResponse.json({ outstandingPayments: rows });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}