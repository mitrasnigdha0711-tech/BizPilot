import { NextResponse } from 'next/server';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

class Conflict extends Error {}

type RouteContext = { params: { invoiceId: string; lineItemId: string } };

const ALLOWED_ROLES = ['FREELANCE_VIDEO_EDITOR', 'SMALL_VIDEO_EDITING_BUSINESS_OWNER'];
const EDITABLE_STATUSES: InvoiceStatus[] = [InvoiceStatus.DRAFT, InvoiceStatus.SENT];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
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

function handleError(e: unknown): NextResponse {
  if (e instanceof Conflict) {
    return NextResponse.json({ error: e.message }, { status: 409 });
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}

async function loadScope(userId: string, invoiceId: string) {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, businessId: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ALLOWED_ROLES.includes(dbUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      userId: true,
      businessId: true,
      status: true,
      amountPaid: true,
    },
  });

  const allowed =
    !!invoice &&
    (dbUser.role === 'FREELANCE_VIDEO_EDITOR'
      ? invoice.userId === dbUser.id
      : !!dbUser.businessId && invoice.businessId === dbUser.businessId);

  if (!invoice || !allowed) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return invoice;
}

async function recalcInvoice(tx: Prisma.TransactionClient, invoiceId: string) {
  const current = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { amountPaid: true },
  });
  const sum = await tx.invoiceLineItem.aggregate({
    where: { invoiceId },
    _sum: { amount: true },
  });
  const amount = (sum._sum.amount ?? new Prisma.Decimal(0)).toDecimalPlaces(2);
  if (amount.lessThan(current.amountPaid)) {
    throw new Conflict('Invoice amount cannot drop below the amount already paid.');
  }
  return tx.invoice.update({
    where: { id: invoiceId },
    data: {
      amount,
      balanceDue: amount.minus(current.amountPaid),
    },
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const { invoiceId, lineItemId } = params;
  if (!isUuid(invoiceId) || !isUuid(lineItemId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const input = body as Record<string, unknown>;

  const scope = await loadScope(user.id, invoiceId);
  if (scope instanceof Response) return scope;

  if (!EDITABLE_STATUSES.includes(scope.status)) {
    return NextResponse.json(
      { error: 'Line items can only be edited while the invoice is draft or sent' },
      { status: 409 },
    );
  }

  const data: {
    description?: string;
    quantity?: Prisma.Decimal;
    unitPrice?: Prisma.Decimal;
  } = {};

  if ('description' in input) {
    if (typeof input.description !== 'string' || !input.description.trim()) {
      return NextResponse.json({ error: 'Each line item needs a description.' }, { status: 400 });
    }
    data.description = input.description.trim();
  }

  if ('quantity' in input) {
    const quantity = toDecimal(input.quantity);
    if (!quantity || quantity.lessThanOrEqualTo(0)) {
      return NextResponse.json(
        { error: 'Quantity must be greater than 0 and unit price cannot be negative.' },
        { status: 400 },
      );
    }
    data.quantity = quantity;
  }

  if ('unitPrice' in input) {
    const unitPrice = toDecimal(input.unitPrice);
    if (!unitPrice || unitPrice.isNegative()) {
      return NextResponse.json(
        { error: 'Quantity must be greater than 0 and unit price cannot be negative.' },
        { status: 400 },
      );
    }
    data.unitPrice = unitPrice;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.invoiceLineItem.findFirst({
        where: { id: lineItemId, invoiceId },
      });
      if (!existing) return null;

      const quantity = data.quantity ?? existing.quantity;
      const unitPrice = data.unitPrice ?? existing.unitPrice;

      const lineItem = await tx.invoiceLineItem.update({
        where: { id: lineItemId },
        data: {
          ...data,
          amount: quantity.mul(unitPrice).toDecimalPlaces(2),
        },
      });

      const invoice = await recalcInvoice(tx, invoiceId);
      return { lineItem, invoice };
    });

    if (!result) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ lineItem: result.lineItem, invoice: result.invoice });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const { invoiceId, lineItemId } = params;
  if (!isUuid(invoiceId) || !isUuid(lineItemId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const scope = await loadScope(user.id, invoiceId);
  if (scope instanceof Response) return scope;

  if (!EDITABLE_STATUSES.includes(scope.status)) {
    return NextResponse.json(
      { error: 'Line items can only be removed while the invoice is draft or sent' },
      { status: 409 },
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const paymentCount = await tx.payment.count({ where: { invoiceId } });
      if (paymentCount > 0) {
        throw new Conflict('Line items cannot be removed once a payment is recorded.');
      }

      const existing = await tx.invoiceLineItem.findFirst({
        where: { id: lineItemId, invoiceId },
      });
      if (!existing) return null;

      const remaining = await tx.invoiceLineItem.count({ where: { invoiceId } });
      if (remaining <= 1) {
        throw new Conflict('An invoice must keep at least one line item.');
      }

      await tx.invoiceLineItem.delete({ where: { id: lineItemId } });
      const invoice = await recalcInvoice(tx, invoiceId);
      return { invoice };
    });

    if (!result) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ invoice: result.invoice });
  } catch (e) {
    return handleError(e);
  }
}