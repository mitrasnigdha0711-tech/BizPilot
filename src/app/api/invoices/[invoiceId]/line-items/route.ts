import { NextRequest, NextResponse } from 'next/server';
import { InvoiceStatus, Prisma, Role } from '@prisma/client';
import type { InvoiceLineItem } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_ROLES: Role[] = [
  Role.FREELANCE_VIDEO_EDITOR,
  Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER,
];

type Caller = {
  id: string;
  role: Role;
  businessId: string;
};

async function resolveCaller(request: NextRequest): Promise<Caller | Response> {
  const sessionUser = await requireUser(request);
  if (sessionUser instanceof Response) return sessionUser;

  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, role: true, businessId: true, isActive: true },
  });

  if (!dbUser || !dbUser.isActive) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!ALLOWED_ROLES.includes(dbUser.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!dbUser.businessId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return { id: dbUser.id, role: dbUser.role, businessId: dbUser.businessId };
}

function canSeeInvoice(
  caller: Caller,
  invoice: { businessId: string; userId: string },
): boolean {
  if (invoice.businessId !== caller.businessId) return false;
  if (caller.role === Role.FREELANCE_VIDEO_EDITOR && invoice.userId !== caller.id) {
    return false;
  }
  return true;
}

function serializeLineItem(item: InvoiceLineItem) {
  return {
    id: item.id,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    invoiceId: item.invoiceId,
    description: item.description,
    quantity: Number(item.quantity.toString()),
    unitPrice: Number(item.unitPrice.toString()),
    amount: Number(item.amount.toString()),
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { invoiceId: string } },
) {
  const caller = await resolveCaller(request);
  if (caller instanceof Response) return caller;

  const { invoiceId } = params;
  if (!UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { businessId: true, userId: true },
    });

    if (!invoice || !canSeeInvoice(caller, invoice)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const items = await prisma.invoiceLineItem.findMany({
      where: { invoiceId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ lineItems: items.map(serializeLineItem) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { invoiceId: string } },
) {
  const caller = await resolveCaller(request);
  if (caller instanceof Response) return caller;

  const { invoiceId } = params;
  if (!UUID_RE.test(invoiceId)) {
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

  const { description, quantity, unitPrice } = body as Record<string, unknown>;

  if (typeof description !== 'string' || description.trim() === '') {
    return NextResponse.json(
      { error: 'Each line item needs a description.' },
      { status: 400 },
    );
  }

  const qty = quantity === undefined ? 1 : Number(quantity);
  if (
    quantity === null ||
    quantity === '' ||
    !Number.isFinite(qty) ||
    qty <= 0
  ) {
    return NextResponse.json(
      { error: 'Quantity must be greater than 0 and unit price cannot be negative.' },
      { status: 400 },
    );
  }

  if (unitPrice === undefined || unitPrice === null || unitPrice === '') {
    return NextResponse.json(
      { error: 'Quantity must be greater than 0 and unit price cannot be negative.' },
      { status: 400 },
    );
  }
  const price = Number(unitPrice);
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json(
      { error: 'Quantity must be greater than 0 and unit price cannot be negative.' },
      { status: 400 },
    );
  }

  const quantityDec = new Prisma.Decimal(qty).toDecimalPlaces(2);
  const unitPriceDec = new Prisma.Decimal(price).toDecimalPlaces(2);
  const amountDec = quantityDec.mul(unitPriceDec).toDecimalPlaces(2);

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { businessId: true, userId: true, status: true, amountPaid: true },
    });

    if (!invoice || !canSeeInvoice(caller, invoice)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      return NextResponse.json(
        { error: 'Line items can only be added to a draft invoice' },
        { status: 409 },
      );
    }

    const lineItem = await prisma.$transaction(async (tx) => {
      const created = await tx.invoiceLineItem.create({
        data: {
          invoiceId,
          description: description.trim(),
          quantity: quantityDec,
          unitPrice: unitPriceDec,
          amount: amountDec,
        },
      });

      const agg = await tx.invoiceLineItem.aggregate({
        where: { invoiceId },
        _sum: { amount: true },
      });

      const total = (agg._sum.amount ?? new Prisma.Decimal(0)).toDecimalPlaces(2);
      const balance = total.sub(invoice.amountPaid);

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amount: total,
          balanceDue: balance.isNegative() ? new Prisma.Decimal(0) : balance,
        },
      });

      return created;
    });

    return NextResponse.json({ lineItem: serializeLineItem(lineItem) }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}