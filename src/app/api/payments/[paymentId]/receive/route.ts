import { NextResponse } from 'next/server';
import { Prisma, Role, InvoiceStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const ALLOWED_ROLES: Role[] = [
  Role.FREELANCE_VIDEO_EDITOR,
  Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER,
];

export async function POST(
  request: Request,
  { params }: { params: { paymentId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, businessId: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ALLOWED_ROLES.includes(dbUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown = {};
  let raw = '';
  try {
    raw = await request.text();
  } catch {
    raw = '';
  }
  if (raw.trim()) {
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
  }

  const receivedAtRaw =
    body && typeof body === 'object'
      ? (body as { received_at?: unknown }).received_at
      : undefined;

  let receivedAt: Date = new Date();
  if (receivedAtRaw !== undefined && receivedAtRaw !== null && receivedAtRaw !== '') {
    if (typeof receivedAtRaw !== 'string') {
      return NextResponse.json({ error: 'received_at must be a date string' }, { status: 400 });
    }
    const parsed = new Date(receivedAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'received_at is not a valid date' }, { status: 400 });
    }
    receivedAt = parsed;
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { id: params.paymentId },
      include: { invoice: true },
    });

    const allowed =
      payment !== null &&
      (dbUser.role === Role.FREELANCE_VIDEO_EDITOR
        ? payment.userId === user.id
        : payment.invoice.businessId === dbUser.businessId);

    if (!payment || !allowed) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (payment.status === PaymentStatus.RECEIVED) {
      return NextResponse.json({ error: 'Payment is already received' }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const receivedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.RECEIVED, receivedAt },
      });

      const agg = await tx.payment.aggregate({
        where: { invoiceId: payment.invoiceId, status: PaymentStatus.RECEIVED },
        _sum: { amount: true },
      });

      const amountPaid = agg._sum.amount ?? new Prisma.Decimal(0);
      const invoiceAmount = payment.invoice.amount;

      let balanceDue = invoiceAmount.minus(amountPaid);
      if (balanceDue.lt(0)) {
        balanceDue = new Prisma.Decimal(0);
      }

      const now = new Date();
      let nextStatus: InvoiceStatus;
      if (balanceDue.lte(0)) {
        nextStatus = InvoiceStatus.PAID;
      } else if (payment.invoice.dueDate.getTime() < now.getTime()) {
        nextStatus = InvoiceStatus.OVERDUE;
      } else if (amountPaid.gt(0)) {
        nextStatus = InvoiceStatus.PARTIALLY_PAID;
      } else {
        nextStatus = InvoiceStatus.SENT;
      }

      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: { amountPaid, balanceDue, status: nextStatus },
      });

      return receivedPayment;
    });

    return NextResponse.json({ payment: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}