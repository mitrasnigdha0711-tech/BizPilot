import { NextResponse } from 'next/server';
import { Prisma, Role, RecurringBillStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: { recurringBillId: string } }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, role: true, businessId: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  let scope: Prisma.RecurringBillWhereInput;
  if (dbUser.role === Role.FREELANCE_VIDEO_EDITOR) {
    scope = { userId: dbUser.id };
  } else if (dbUser.role === Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
    if (!dbUser.businessId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    scope = { businessId: dbUser.businessId };
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const recurringBillId = params.recurringBillId;
  if (!UUID_PATTERN.test(recurringBillId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const bill = await prisma.recurringBill.findFirst({
      where: { id: recurringBillId, ...scope },
    });
    if (!bill) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (bill.status !== RecurringBillStatus.ACTIVE) {
      return NextResponse.json(
        { error: 'Only an active recurring bill can be paused' },
        { status: 409 }
      );
    }

    const recurringBill = await prisma.recurringBill.update({
      where: { id: bill.id },
      data: { status: RecurringBillStatus.PAUSED },
    });

    return NextResponse.json({ recurringBill });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}