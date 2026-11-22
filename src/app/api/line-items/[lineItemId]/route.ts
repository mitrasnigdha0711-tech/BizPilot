import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const ALLOWED_ROLES: string[] = ['FREELANCE_VIDEO_EDITOR', 'SMALL_VIDEO_EDITING_BUSINESS_OWNER'];

class AmountBelowPaidError extends Error {}

async function authorize(request: Request): Promise<{ businessId: string } | Response> {
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
  if (!dbUser.businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return { businessId: dbUser.businessId };
}

function toDecimal(value: unknown): Prisma.Decimal | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  try {
    const d = new Prisma.Decimal(value);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

async function recalcInvoice(
  tx: Prisma.TransactionClient,
  invoiceId: string,
  amountPaid: Prisma.Decimal,
): Promise<void> {
  const agg = await tx.invoiceLineItem.aggregate({
    where: { invoiceId },
    _sum: { amount: true },
  });
  const amount = agg._sum.amount ?? new Prisma.Decimal(0);
  if (amount.lessThan(amountPaid)) {
    throw new AmountBelowPaidError('Invoice amount cannot drop below amount paid');
  }
  await tx.invoice.update({
    where: { id: invoiceId },
    data: { amount, balanceDue: amount.sub(amountPaid) },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { lineItemId: string } },
) {
  const auth = await authorize(request);
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const input = body as Record<string, unknown>;

  const data: { description?: string; quantity?: Prisma.Decimal; unitPrice?: Prisma.Decimal } = {};

  if (input.description !== undefined) {
    if (typeof input.description !== 'string' || input.description.trim() === '') {
      return NextResponse.json({ error: 'description must be a non-empty string' }, { status: 400 });
    }
    data.description = input.description.trim();
  }
  if (input.quantity !== undefined) {
    const quantity = toDecimal(input.quantity);
    if (!quantity || quantity.lessThanOrEqualTo(0)) {
      return NextResponse.json({ error: 'quantity must be a positive number' }, { status: 400 });
    }
    data.quantity = quantity;
  }
  if (input.unitPrice !== undefined) {
    const unitPrice = toDecimal(input.unitPrice);
    if (!unitPrice || unitPrice.lessThan(0)) {
      return NextResponse.json({ error: 'unitPrice must be a non-negative number' }, { status: 400 });
    }
    data.unitPrice = unitPrice;
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.invoiceLineItem.findUnique({
        where: { id: params.lineItemId },
        include: { invoice: true },
      });
      if (!current || current.invoice.businessId !== auth.businessId) {
        return null;
      }

      const quantity = data.quantity ?? current.quantity;
      const unitPrice = data.unitPrice ?? current.unitPrice;
      const amount = quantity.mul(unitPrice);

      const lineItem = await tx.invoiceLineItem.update({
        where: { id: current.id },
        data: {
          ...(data.description !== undefined ? { description: data.description } : {}),
          quantity,
          unitPrice,
          amount,
        },
      });

      await recalcInvoice(tx, current.invoiceId, current.invoice.amountPaid);
      return lineItem;
    });

    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ lineItem: updated });
  } catch (e) {
    if (e instanceof AmountBelowPaidError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { lineItemId: string } },
) {
  const auth = await authorize(request);
  if (auth instanceof Response) return auth;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.invoiceLineItem.findUnique({
        where: { id: params.lineItemId },
        include: { invoice: true },
      });
      if (!current || current.invoice.businessId !== auth.businessId) {
        return false;
      }

      await tx.invoiceLineItem.delete({ where: { id: current.id } });
      await recalcInvoice(tx, current.invoiceId, current.invoice.amountPaid);
      return true;
    });

    if (!result) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (e instanceof AmountBelowPaidError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}