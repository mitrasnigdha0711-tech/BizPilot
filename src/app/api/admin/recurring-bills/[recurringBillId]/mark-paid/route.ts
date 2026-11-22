import { NextResponse } from 'next/server';
import { Prisma, RecurringBillStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OWNER_ROLE = 'small_video_editing_business_owner';

function addMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const targetMonth = date.getUTCMonth() + months;
  const lastDayOfTargetMonth = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDayOfTargetMonth);
  return new Date(
    Date.UTC(
      year,
      targetMonth,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

function advanceByFrequency(from: Date, frequency: string): Date {
  switch (frequency) {
    case 'WEEKLY':
      return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'MONTHLY':
      return addMonths(from, 1);
    case 'QUARTERLY':
      return addMonths(from, 3);
    case 'YEARLY':
      return addMonths(from, 12);
    default:
      return addMonths(from, 1);
  }
}

export async function POST(
  request: Request,
  { params }: { params: { recurringBillId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (String(user.role).toLowerCase() !== OWNER_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const recurringBillId = params.recurringBillId;
  if (!UUID_RE.test(recurringBillId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const owner = await prisma.user.findUnique({
      where: { id: user.id },
      select: { businessId: true },
    });
    if (!owner?.businessId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const bill = await prisma.recurringBill.findFirst({
      where: { id: recurringBillId, businessId: owner.businessId },
    });
    if (!bill) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (bill.status !== RecurringBillStatus.ACTIVE) {
      return NextResponse.json(
        { error: 'Only active recurring bills can be marked as paid' },
        { status: 409 },
      );
    }

    const now = new Date();
    const nextDueDate = advanceByFrequency(bill.nextDueDate, String(bill.frequency));
    const nextStatus =
      bill.endDate && nextDueDate.getTime() > bill.endDate.getTime()
        ? RecurringBillStatus.ENDED
        : bill.status;

    const updated = await prisma.recurringBill.update({
      where: { id: bill.id },
      data: {
        lastPaidAt: now,
        nextDueDate,
        status: nextStatus,
      },
    });

    return NextResponse.json({
      recurringBill: {
        ...updated,
        amount: updated.amount.toNumber(),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('mark-paid failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}