import { NextResponse } from 'next/server';
import { InvoiceStatus, Prisma, ReminderStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const OWNER_ROLE = 'small_video_editing_business_owner';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBJECT_MAX = 150;
const BODY_MAX = 5000;

export async function POST(
  request: Request,
  { params }: { params: { reminderId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (user.role !== OWNER_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const reminderId = params.reminderId;
  if (!UUID_RE.test(reminderId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { businessId: true },
    });

    let businessId: string | null = dbUser?.businessId ?? null;
    if (!businessId) {
      const business = await prisma.business.findFirst({
        where: { userId: user.id },
        select: { id: true },
      });
      businessId = business?.id ?? null;
    }
    if (!businessId) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const reminder = await prisma.reminder.findUnique({
      where: { id: reminderId },
      include: {
        invoice: {
          select: { id: true, businessId: true, amount: true, status: true },
        },
        client: { select: { email: true } },
      },
    });

    if (!reminder || reminder.invoice.businessId !== businessId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (reminder.status !== ReminderStatus.DRAFT) {
      return NextResponse.json(
        { error: 'Only a draft reminder can be approved' },
        { status: 409 },
      );
    }

    const subject = reminder.subject.trim();
    if (!subject) {
      return NextResponse.json(
        { error: 'Please add a subject line for this reminder.' },
        { status: 400 },
      );
    }
    if (subject.length > SUBJECT_MAX) {
      return NextResponse.json(
        { error: 'Subject must be 150 characters or fewer.' },
        { status: 400 },
      );
    }

    const body = reminder.body.trim();
    if (!body) {
      return NextResponse.json(
        { error: 'Please write a message body before sending this reminder.' },
        { status: 400 },
      );
    }
    if (body.length > BODY_MAX) {
      return NextResponse.json(
        { error: 'Message must be 5000 characters or fewer.' },
        { status: 400 },
      );
    }

    const recipientEmail = reminder.client.email?.trim() ?? '';
    if (!EMAIL_RE.test(recipientEmail)) {
      return NextResponse.json(
        {
          error:
            'The client needs a valid email address on record before this reminder can be approved.',
        },
        { status: 400 },
      );
    }

    if (reminder.invoice.status === InvoiceStatus.PAID) {
      return NextResponse.json(
        { error: 'This invoice is already paid' },
        { status: 409 },
      );
    }

    const paidAgg = await prisma.payment.aggregate({
      where: { invoiceId: reminder.invoice.id },
      _sum: { amount: true },
    });
    const totalPaid: Prisma.Decimal = paidAgg._sum.amount ?? new Prisma.Decimal(0);
    const balanceDue = reminder.invoice.amount.minus(totalPaid);

    if (balanceDue.lte(0)) {
      return NextResponse.json(
        { error: 'This invoice has no balance due' },
        { status: 409 },
      );
    }

    const approved = await prisma.reminder.update({
      where: { id: reminderId },
      data: {
        status: ReminderStatus.APPROVED,
        approvedAt: new Date(),
      },
    });

    return NextResponse.json({ reminder: approved });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}