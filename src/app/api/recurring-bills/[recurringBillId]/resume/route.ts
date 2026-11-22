import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const FREELANCE_VIDEO_EDITOR = 'FREELANCE_VIDEO_EDITOR';
const SMALL_VIDEO_EDITING_BUSINESS_OWNER = 'SMALL_VIDEO_EDITING_BUSINESS_OWNER';

function isDayString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function POST(
  request: Request,
  { params }: { params: { recurringBillId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, role: true, businessId: true, isActive: true },
  });
  if (!me || !me.isActive) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isOwner = me.role === SMALL_VIDEO_EDITING_BUSINESS_OWNER;
  const isFreelancer = me.role === FREELANCE_VIDEO_EDITOR;
  if (!isOwner && !isFreelancer) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (isOwner && !me.businessId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const scope: Prisma.RecurringBillWhereInput = isOwner
    ? { businessId: me.businessId as string }
    : { userId: me.id };

  const bill = await prisma.recurringBill.findFirst({
    where: { id: params.recurringBillId, ...scope },
  });
  if (!bill) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (bill.status !== 'PAUSED') {
    return NextResponse.json(
      { error: 'Only a paused recurring bill can be resumed' },
      { status: 409 },
    );
  }

  const dateParam = new URL(request.url).searchParams.get('date');
  if (dateParam !== null && !isDayString(dateParam)) {
    return NextResponse.json(
      { error: 'date must be in YYYY-MM-DD format' },
      { status: 400 },
    );
  }
  const day = dateParam ?? new Date().toLocaleDateString('en-CA');
  const today = new Date(day + 'T00:00:00Z');

  if (bill.endDate && today.getTime() > bill.endDate.getTime()) {
    return NextResponse.json(
      { error: 'This bill has already ended and cannot be resumed' },
      { status: 409 },
    );
  }

  try {
    const recurringBill = await prisma.recurringBill.update({
      where: { id: bill.id },
      data: {
        status: 'ACTIVE',
        nextDueDate: today,
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