import { NextResponse } from 'next/server';
import { Prisma, RecurringBillStatus, RecurringFrequency } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OWNER_ROLE = 'small_video_editing_business_owner';
const ALLOWED_ROLES = ['freelance_video_editor', OWNER_ROLE];

function advanceByFrequency(from: Date, frequency: RecurringFrequency): Date {
  const next = new Date(from.getTime());
  switch (frequency) {
    case 'WEEKLY':
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case 'MONTHLY':
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case 'QUARTERLY':
      next.setUTCMonth(next.getUTCMonth() + 3);
      break;
    case 'YEARLY':
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      break;
  }
  return next;
}

export async function POST(
  request: Request,
  { params }: { params: { recurringBillId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const recurringBillId = params.recurringBillId;
  if (!UUID_RE.test(recurringBillId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    const role = String(dbUser.role).toLowerCase();
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const bill = await prisma.recurringBill.findUnique({
      where: { id: recurringBillId },
    });
    if (!bill) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const inScope =
      role === OWNER_ROLE
        ? dbUser.businessId !== null && bill.businessId === dbUser.businessId
        : bill.userId === dbUser.id;
    if (!inScope) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (bill.status !== RecurringBillStatus.ACTIVE) {
      return NextResponse.json(
        { error: 'Only active recurring bills can be marked as paid' },
        { status: 409 },
      );
    }

    const now = new Date();
    const nextDueDate = advanceByFrequency(bill.nextDueDate, bill.frequency);
    const ended =
      bill.endDate !== null && nextDueDate.getTime() > bill.endDate.getTime();

    const recurringBill = await prisma.recurringBill.update({
      where: { id: bill.id },
      data: {
        lastPaidAt: now,
        nextDueDate,
        status: ended ? RecurringBillStatus.ENDED : RecurringBillStatus.ACTIVE,
      },
    });

    return NextResponse.json({ recurringBill });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}