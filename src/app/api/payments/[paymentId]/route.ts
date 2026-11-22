import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const FREELANCE_ROLE = 'freelance_video_editor';
const OWNER_ROLE = 'small_video_editing_business_owner';
const ALLOWED_ROLES = [FREELANCE_ROLE, OWNER_ROLE];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

type RouteContext = { params: { paymentId: string } };

function roundCents(n: number): number {
  return Math.round(n * 100) / 100;
}

function todayUtc(): Date {
  return new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
}

async function loadAccessiblePayment(paymentId: string, userId: string, role: string) {
  if (!UUID_RE.test(paymentId)) return null;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { invoice: true, client: true },
  });
  if (!payment) return null;

  if (role === FREELANCE_ROLE) {
    if (payment.userId !== userId) return null;
  } else if (role === OWNER_ROLE) {
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { businessId: true },
    });
    if (!me?.businessId || payment.invoice.businessId !== me.businessId) return null;
  } else {
    return null;
  }

  return payment;
}

function toWirePayment(p: {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  invoiceId: string;
  clientId: string;
  amount: Prisma.Decimal;
  status: string;
  expectedDate: Date | null;
  receivedAt: Date | null;
  userId: string;
}) {
  return {
    id: p.id,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    invoiceId: p.invoiceId,
    clientId: p.clientId,
    amount: Number(p.amount),
    status: p.status,
    expectedDate: p.expectedDate,
    receivedAt: p.receivedAt,
    userId: p.userId,
  };
}

export async function GET(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const payment = await loadAccessiblePayment(params.paymentId, user.id, user.role);
    if (!payment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({
      payment: {
        ...toWirePayment(payment),
        invoice: {
          id: payment.invoice.id,
          invoiceNumber: payment.invoice.invoiceNumber,
          clientId: payment.invoice.clientId,
          projectId: payment.invoice.projectId,
          status: payment.invoice.status,
          issueDate: payment.invoice.issueDate,
          dueDate: payment.invoice.dueDate,
          amount: Number(payment.invoice.amount),
          amountPaid: Number(payment.invoice.amountPaid),
          balanceDue: Number(payment.invoice.balanceDue),
          businessId: payment.invoice.businessId,
          userId: payment.invoice.userId,
        },
        client: {
          id: payment.client.id,
          name: payment.client.name,
          email: payment.client.email,
          phone: payment.client.phone,
          address: payment.client.address,
          status: payment.client.status,
          businessId: payment.client.businessId,
          userId: payment.client.userId,
        },
      },
    });
  } catch (e) {
    console.error('GET /api/payments/[paymentId] failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be an object' }, { status: 400 });
  }

  const input = body as { amount?: unknown; expectedDate?: unknown };

  let nextAmount: number | undefined;
  if (input.amount !== undefined) {
    if (typeof input.amount !== 'number' || !Number.isFinite(input.amount) || input.amount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }
    nextAmount = roundCents(input.amount);
  }

  let nextExpectedDate: Date | null | undefined;
  if (input.expectedDate !== undefined) {
    if (input.expectedDate === null) {
      nextExpectedDate = null;
    } else if (typeof input.expectedDate === 'string' && DAY_RE.test(input.expectedDate)) {
      const parsed = new Date(input.expectedDate + 'T00:00:00Z');
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Expected date is not a valid date' }, { status: 400 });
      }
      nextExpectedDate = parsed;
    } else {
      return NextResponse.json(
        { error: 'Expected date must be in YYYY-MM-DD format' },
        { status: 400 },
      );
    }
  }

  if (nextAmount === undefined && nextExpectedDate === undefined) {
    return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });
  }

  try {
    const existing = await loadAccessiblePayment(params.paymentId, user.id, user.role);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (existing.status !== 'EXPECTED') {
      return NextResponse.json(
        { error: 'A received payment cannot be edited' },
        { status: 409 },
      );
    }

    if (nextAmount !== undefined) {
      const cap = roundCents(Number(existing.invoice.balanceDue) + Number(existing.amount));
      if (nextAmount > cap + 0.000001) {
        return NextResponse.json(
          { error: 'Amount is above the invoice balance due' },
          { status: 400 },
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: existing.id },
        data: {
          ...(nextAmount !== undefined ? { amount: nextAmount } : {}),
          ...(nextExpectedDate !== undefined ? { expectedDate: nextExpectedDate } : {}),
        },
      });

      const invoice = await tx.invoice.findUnique({ where: { id: existing.invoiceId } });
      if (!invoice) {
        throw new Error('Invoice missing for payment');
      }

      const agg = await tx.payment.aggregate({
        where: { invoiceId: invoice.id },
        _sum: { amount: true },
      });
      const amountPaid = roundCents(Number(agg._sum.amount ?? 0));
      const totalAmount = Number(invoice.amount);
      const balanceDue = roundCents(Math.max(0, totalAmount - amountPaid));

      let status: string = invoice.status;
      if (invoice.status !== 'DRAFT') {
        if (balanceDue <= 0) {
          status = 'PAID';
        } else if (amountPaid > 0) {
          status = 'PARTIALLY_PAID';
        } else {
          const dueDay = new Date(invoice.dueDate.toISOString().slice(0, 10) + 'T00:00:00Z');
          status = dueDay.getTime() < todayUtc().getTime() ? 'OVERDUE' : 'SENT';
        }
      }

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid,
          balanceDue,
          status: status as never,
        },
      });

      return updated;
    });

    return NextResponse.json({ payment: toWirePayment(result) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('PATCH /api/payments/[paymentId] failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}