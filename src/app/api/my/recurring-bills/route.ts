import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const FREELANCE_ROLE = 'freelance_video_editor';
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function toDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (String(user.role).toLowerCase() !== FREELANCE_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const dayParam = new URL(request.url).searchParams.get('date');
  const day = dayParam && DAY_PATTERN.test(dayParam) ? dayParam : toDay(new Date());

  try {
    const bills = await prisma.recurringBill.findMany({
      where: { userId: user.id },
      orderBy: { nextDueDate: 'asc' },
    });

    const recurringBills = bills.map((bill) => {
      const dueDay = toDay(bill.nextDueDate);
      const dueState = dueDay < day ? 'overdue' : dueDay === day ? 'due' : 'pending';

      return {
        id: bill.id,
        name: bill.name,
        amount: Number(bill.amount.toString()),
        startDate: toDay(bill.startDate),
        endDate: bill.endDate ? toDay(bill.endDate) : null,
        nextDueDate: dueDay,
        lastPaidAt: bill.lastPaidAt ? bill.lastPaidAt.toISOString() : null,
        dueState,
        businessId: bill.businessId,
        createdAt: bill.createdAt.toISOString(),
        updatedAt: bill.updatedAt.toISOString(),
      };
    });

    return NextResponse.json({ recurringBills });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}