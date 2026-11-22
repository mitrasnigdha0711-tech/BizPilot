import { NextRequest, NextResponse } from 'next/server';
import { Prisma, InvoiceStatus, PaymentStatus, Role } from '@prisma/client';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

type Scope = {
  userId: string;
  invoiceScope: Prisma.InvoiceWhereInput;
};

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function resolveScope(request: NextRequest): Promise<Scope | Response> {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, businessId: true },
  });
  if (!me) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (me.role === Role.FREELANCE_VIDEO_EDITOR) {
    return { userId: user.id, invoiceScope: { userId: user.id } };
  }

  if (me.role === Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
    if (!me.businessId) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }
    return { userId: user.id, invoiceScope: { businessId: me.businessId } };
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function handleError(e: unknown): Response {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  const scope = await resolveScope(request);
  if (scope instanceof Response) return scope;

  const { invoiceId } = params;
  if (!UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, ...scope.invoiceScope },
      select: { id: true },
    });
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const payments = await prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ payments });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  const scope = await resolveScope(request);
  if (scope instanceof Response) return scope;

  const { invoiceId } = params;
  if (!UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { amount, status, expectedDate, receivedAt } = body as Record<string, unknown>;

  // Amount validation
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return NextResponse.json({ error: 'Enter the amount received.' }, { status: 400 });
  }
  if (Math.round(amount * 100) / 100 !== amount) {
    return NextResponse.json(
      { error: 'Amount can have at most two decimal places.' },
      { status: 400 }
    );
  }

  // Status validation
  let paymentStatus: PaymentStatus = PaymentStatus.RECEIVED;
  if (status !== undefined) {
    if (status === 'expected') paymentStatus = PaymentStatus.EXPECTED;
    else if (status === 'received') paymentStatus = PaymentStatus.RECEIVED;
    else {
      return NextResponse.json({ error: 'Invalid payment status' }, { status: 400 });
    }
  }

  // Expected date (calendar day)
  let expectedDay: Date | null = null;
  if (expectedDate !== undefined && expectedDate !== null) {
    if (typeof expectedDate !== 'string' || !DAY_RE.test(expectedDate)) {
      return NextResponse.json(
        { error: 'Enter a valid expected date (YYYY-MM-DD).' },
        { status: 400 }
      );
    }
    expectedDay = new Date(`${expectedDate}T00:00:00Z`);
    if (Number.isNaN(expectedDay.getTime())) {
      return NextResponse.json(
        { error: 'Enter a valid expected date (YYYY-MM-DD).' },
        { status: 400 }
      );
    }
  }

  // Received timestamp
  let receivedDate: Date | null = null;
  if (receivedAt !== undefined && receivedAt !== null) {
    if (typeof receivedAt !== 'string') {
      return NextResponse.json(
        { error: 'Select the date the payment was received.' },
        { status: 400 }
      );
    }
    receivedDate = new Date(receivedAt);
    if (Number.isNaN(receivedDate.getTime())) {
      return NextResponse.json(
        { error: 'Select the date the payment was received.' },
        { status: 400 }
      );
    }
    if (receivedDate.getTime() > Date.now()) {
      return NextResponse.json(
        { error: 'The payment date cannot be in the future.' },
        { status: 400 }
      );
    }
  } else if (paymentStatus === PaymentStatus.RECEIVED) {
    receivedDate = new Date();
  }

  try {
    const payment = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, ...scope.invoiceScope },
        select: {
          id: true,
          clientId: true,
          status: true,
          dueDate: true,
          amount: true,
          balanceDue: true,
        },
      });
      if (!invoice) {
        throw new HttpError(404, 'Invoice not found');
      }
      if (invoice.status === InvoiceStatus.DRAFT) {
        throw new HttpError(409, 'Send the invoice before recording a payment');
      }

      const amountDec = new Prisma.Decimal(amount);
      if (amountDec.lte(0) || amountDec.gt(invoice.balanceDue)) {
        throw new HttpError(
          400,
          `Enter an amount between 0.01 and the remaining balance of ${invoice.balanceDue.toFixed(2)}.`
        );
      }

      const created = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          clientId: invoice.clientId,
          amount: amountDec,
          status: paymentStatus,
          expectedDate: expectedDay,
          receivedAt: paymentStatus === PaymentStatus.RECEIVED ? receivedDate : receivedDate,
          userId: scope.userId,
        },
      });

      const agg = await tx.payment.aggregate({
        where: { invoiceId: invoice.id, status: PaymentStatus.RECEIVED },
        _sum: { amount: true },
      });
      const amountPaid = agg._sum.amount ?? new Prisma.Decimal(0);
      let balanceDue = invoice.amount.minus(amountPaid);
      if (balanceDue.lt(0)) balanceDue = new Prisma.Decimal(0);

      const todayStart = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);

      let nextStatus: InvoiceStatus;
      if (balanceDue.lte(0)) {
        nextStatus = InvoiceStatus.PAID;
      } else if (invoice.dueDate.getTime() < todayStart.getTime()) {
        nextStatus = InvoiceStatus.OVERDUE;
      } else if (amountPaid.gt(0)) {
        nextStatus = InvoiceStatus.PARTIALLY_PAID;
      } else {
        nextStatus = InvoiceStatus.SENT;
      }

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid,
          balanceDue,
          status: nextStatus,
        },
      });

      return created;
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}