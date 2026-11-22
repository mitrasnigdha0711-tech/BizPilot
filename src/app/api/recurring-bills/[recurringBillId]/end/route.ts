import { NextResponse } from 'next/server';
import { Prisma, RecurringBillStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const OWNER_ROLE = 'small_video_editing_business_owner';
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(
  request: Request,
  { params }: { params: { recurringBillId: string } }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (user.role !== OWNER_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { businessId: true },
  });
  if (!dbUser?.businessId) {
    return NextResponse.json({ error: 'No business linked to this account' }, { status: 403 });
  }

  const url = new URL(request.url);
  const requestedDay = url.searchParams.get('date');
  if (requestedDay !== null && !DAY_PATTERN.test(requestedDay)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
  }
  const day = requestedDay ?? new Date().toLocaleDateString('en-CA');
  const endDay = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(endDay.getTime())) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
  }

  const recurringBillId = params.recurringBillId;

  const existing = await prisma.recurringBill.findFirst({
    where: { id: recurringBillId, businessId: dbUser.businessId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (existing.status === RecurringBillStatus.ENDED) {
    return NextResponse.json({ error: 'Recurring bill has already ended' }, { status: 409 });
  }

  // Keep an earlier end date the bill already had; otherwise end it on the given day.
  const newEndDate =
    existing.endDate && existing.endDate.getTime() < endDay.getTime()
      ? existing.endDate
      : endDay;

  try {
    const recurringBill = await prisma.recurringBill.update({
      where: { id: recurringBillId },
      data: {
        status: RecurringBillStatus.ENDED,
        endDate: newEndDate,
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