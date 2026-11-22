import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

type RouteParams = { params: { invoiceId: string; lineItemId: string } };

const OWNER_ROLE = 'small_video_editing_business_owner';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class AmountBelowPaidError extends Error {}

function parseDecimal(value: unknown): Prisma.Decimal | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  try {
    return new Prisma.Decimal(value);
  } catch {
    return null;
  }
}

async function authorize(request: Request, params: RouteParams['params']) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (String(user.role).toLowerCase() !== OWNER_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!UUID_PATTERN.test(params.invoiceId) || !UUID_PATTERN.test(params.lineItemId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { businessId: true },
  });
  if (!dbUser?.businessId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return { businessId: dbUser.businessId };
}

async function recalculateInvoice(tx: Prisma.TransactionClient, invoiceId: string) {
  const [items, invoice] = await Promise.all([
    tx.invoiceLineItem.findMany({ where: { invoiceId }, select: { amount: true } }),
    tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { amountPaid: true } }),
  ]);

  const amount = items
    .reduce((sum, item) => sum.plus(item.amount), new Prisma.Decimal(0))
    .toDecimalPlaces(2);

  if (amount.lt(invoice.amountPaid)) {
    throw new AmountBelowPaidError();
  }

  const balanceDue = amount.minus(invoice.amountPaid).toDecimalPlaces(2);
  await tx.invoice.update({
    where: { id: invoiceId },
    data: { amount, balanceDue },
  });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await authorize(request, params);
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
  }
  const input = body as Record<string, unknown>;

  const data: { description?: string; quantity?: Prisma.Decimal; unitPrice?: Prisma.Decimal } = {};

  if ('description' in input) {
    if (typeof input.description !== 'string' || input.description.trim() === '') {
      return NextResponse.json({ error: 'Each line item needs a description.' }, { status: 400 });
    }
    data.description = input.description.trim();
  }

  if ('quantity' in input) {
    const quantity = parseDecimal(input.quantity);
    if (!quantity || quantity.lte(0)) {
      return NextResponse.json(
        { error: 'Quantity must be greater than 0 and unit price cannot be negative.' },
        { status: 400 },
      );
    }
    data.quantity = quantity.toDecimalPlaces(2);
  }

  if ('unitPrice' in input) {
    const unitPrice = parseDecimal(input.unitPrice);
    if (!unitPrice || unitPrice.lt(0)) {
      return NextResponse.json(
        { error: 'Quantity must be greater than 0 and unit price cannot be negative.' },
        { status: 400 },
      );
    }
    data.unitPrice = unitPrice.toDecimalPlaces(2);
  }

  try {
    const lineItem = await prisma.invoiceLineItem.findFirst({
      where: {
        id: params.lineItemId,
        invoiceId: params.invoiceId,
        invoice: { businessId: auth.businessId },
      },
      include: { invoice: { select: { status: true } } },
    });
    if (!lineItem) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (lineItem.invoice.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Line items can only be changed on a draft invoice' },
        { status: 409 },
      );
    }

    const quantity = data.quantity ?? lineItem.quantity;
    const unitPrice = data.unitPrice ?? lineItem.unitPrice;
    const amount = quantity.mul(unitPrice).toDecimalPlaces(2);

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.invoiceLineItem.update({
        where: { id: lineItem.id },
        data: { ...data, quantity, unitPrice, amount },
      });
      await recalculateInvoice(tx, params.invoiceId);
      return saved;
    });

    return NextResponse.json({ lineItem: updated });
  } catch (e) {
    if (e instanceof AmountBelowPaidError) {
      return NextResponse.json(
        { error: 'Invoice total cannot drop below the amount already paid' },
        { status: 409 },
      );
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const auth = await authorize(request, params);
  if (auth instanceof Response) return auth;

  try {
    const lineItem = await prisma.invoiceLineItem.findFirst({
      where: {
        id: params.lineItemId,
        invoiceId: params.invoiceId,
        invoice: { businessId: auth.businessId },
      },
      include: { invoice: { select: { status: true } } },
    });
    if (!lineItem) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (lineItem.invoice.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Line items can only be removed from a draft invoice' },
        { status: 409 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.invoiceLineItem.delete({ where: { id: lineItem.id } });
      await recalculateInvoice(tx, params.invoiceId);
    });

    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (e instanceof AmountBelowPaidError) {
      return NextResponse.json(
        { error: 'Invoice total cannot drop below the amount already paid' },
        { status: 409 },
      );
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}