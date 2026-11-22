import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

const OWNER_ROLE = 'SMALL_VIDEO_EDITING_BUSINESS_OWNER';
const OPEN_STATUSES = ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] as const;
const DAY_MS = 86400000;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isValidDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (user instanceof Response) return user;

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, businessId: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (dbUser.role !== OWNER_ROLE) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let businessId = dbUser.businessId;
    if (!businessId) {
      const ownedBusiness = await prisma.business.findFirst({
        where: { userId: dbUser.id },
        select: { id: true },
      });
      businessId = ownedBusiness?.id ?? null;
    }
    if (!businessId) {
      return NextResponse.json({ outstandingPayments: [] });
    }

    const dateParam = new URL(request.url).searchParams.get('date');
    if (dateParam !== null && !isValidDay(dateParam)) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }
    const today = dateParam ?? localToday();
    const todayMs = Date.parse(`${today}T00:00:00Z`);

    const invoices = await prisma.invoice.findMany({
      where: {
        businessId,
        status: { in: [...OPEN_STATUSES] },
        balanceDue: { gt: 0 },
      },
      include: {
        client: { select: { id: true, name: true } },
      },
    });

    const rows = invoices.map((inv) => {
      const dueMs = Date.parse(`${inv.dueDate.toISOString().slice(0, 10)}T00:00:00Z`);
      const daysOverdue = Math.round((todayMs - dueMs) / DAY_MS);
      const balance = Number(inv.balanceDue);
      const status =
        daysOverdue > 0 && (inv.status === 'SENT' || inv.status === 'PARTIALLY_PAID')
          ? 'overdue'
          : inv.status.toLowerCase();

      return {
        invoice_id: inv.id,
        invoice_number: inv.invoiceNumber,
        client_id: inv.clientId,
        client_name: inv.client?.name ?? '',
        balance_due: balance,
        due_date: inv.dueDate.toISOString().slice(0, 10),
        days_overdue: daysOverdue,
        status,
      };
    });

    rows.sort((a, b) => {
      if (b.days_overdue !== a.days_overdue) return b.days_overdue - a.days_overdue;
      return b.balance_due - a.balance_due;
    });

    return NextResponse.json({ outstandingPayments: rows });
  } catch (e) {
    console.error('GET /api/admin/outstanding-payments failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}