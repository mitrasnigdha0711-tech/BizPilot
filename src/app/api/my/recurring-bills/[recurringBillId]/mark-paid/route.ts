import { NextResponse } from 'next/server';
import { Prisma, RecurringBillStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function advanceByFrequency(current: Date, frequency: string): Date | null {
  const next = new Date(current.getTime());
  switch (frequency) {
    case 'weekly':
      next.setUTCDate(next.getUTCDate() + 7);
      return next;
    case 'monthly':
      next.setUTCMonth(next.getUTCMonth() + 1);
      return next;
    case 'quarterly':
      next.setUTCMonth(next.getUTCMonth() + 3);
      return next;
    case 'yearly':
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      return next;
    default:
      return null;
  }
}

export async function POST(
  request: Request,
  { params }: { params: { recurringBillId: string } }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const role = String(user.role).toLowerCase();
  if (role !== 'FREELANCE_VIDEO_EDITOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const recurringBillId = params.recurringBillId;
  if (!UUID_RE.test(recurringBillId)) {
    return NextResponse.json({ error: 'Recurring bill not found' }, { status: 404 });
  }

  try {
    const bill = await prisma.recurringBill.findFirst({
      where: { id: recurringBillId, userId: user.id },
    });

    if (!bill) {
      return NextResponse.json({ error: 'Recurring bill not found' }, { status: 404 });
    }

    if (String(bill.status).toLowerCase() !== 'active') {
      return NextResponse.json(
        { error: 'Only active recurring bills can be marked as paid' },
        { status: 409 }
      );
    }

    const frequency = String(bill.frequency).toLowerCase();
    const nextDueDate = advanceByFrequency(bill.nextDueDate, frequency);
    if (!nextDueDate) {
      return NextResponse.json(
        { error: 'Unsupported bill frequency' },
        { status: 422 }
      );
    }

    const hasEnded = bill.endDate !== null && nextDueDate.getTime() > bill.endDate.getTime();

    const updated = await prisma.recurringBill.update({
      where: { id: bill.id },
      data: {
        lastPaidAt: new Date(),
        nextDueDate,
        ...(hasEnded ? { status: RecurringBillStatus.ENDED } : {}),
      },
    });

    const recurringBill = {
      ...updated,
      amount: Number(updated.amount),
      status: String(updated.status).toLowerCase(),
      frequency: String(updated.frequency).toLowerCase(),
    };

    return NextResponse.json({ recurringBill });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Recurring bill not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}