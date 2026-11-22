import { NextResponse } from 'next/server';
import { Prisma, Role, InvoiceStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AMOUNT = new Prisma.Decimal('9999999999.99');

function toDecimal(value: unknown): Prisma.Decimal | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  try {
    const d = new Prisma.Decimal(value);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

export async function POST(
  request: Request,
  { params }: { params: { invoiceId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, businessId: true },
  });
  if (!me) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (me.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!me.businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const businessId = me.businessId;

  const invoiceId = params.invoiceId;
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
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const input = body as Record<string, unknown>;

  if (typeof input.description !== 'string' || input.description.trim() === '') {
    return NextResponse.json(
      { error: 'Each line item needs a description.' },
      { status: 400 },
    );
  }
  const description = input.description.trim();

  const quantityRaw = input.quantity === undefined || input.quantity === null ? 1 : input.quantity;
  const quantityParsed = toDecimal(quantityRaw);
  if (!quantityParsed || quantityParsed.lte(0)) {
    return NextResponse.json(
      { error: 'Quantity must be greater than 0 and unit price cannot be negative.' },
      { status: 400 },
    );
  }
  const unitPriceParsed = toDecimal(input.unitPrice);
  if (!unitPriceParsed || unitPriceParsed.lt(0)) {
    return NextResponse.json(
      { error: 'Quantity must be greater than 0 and unit price cannot be negative.' },
      { status: 400 },
    );
  }

  const quantity = quantityParsed.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const unitPrice = unitPriceParsed.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (quantity.lte(0)) {
    return NextResponse.json(
      { error: 'Quantity must be greater than 0 and unit price cannot be negative.' },
      { status: 400 },
    );
  }
  const amount = quantity.times(unitPrice).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (amount.gt(MAX_AMOUNT)) {
    return NextResponse.json({ error: 'Line item amount is too large' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, businessId },
        select: { id: true, status: true, amountPaid: true },
      });
      if (!invoice) return { kind: 'notFound' as const };
      if (invoice.status !== InvoiceStatus.DRAFT) {
        return { kind: 'notDraft' as const };
      }

      const lineItem = await tx.invoiceLineItem.create({
        data: {
          invoiceId,
          description,
          quantity,
          unitPrice,
          amount,
        },
      });

      const agg = await tx.invoiceLineItem.aggregate({
        where: { invoiceId },
        _sum: { amount: true },
      });
      const total = (agg._sum.amount ?? new Prisma.Decimal(0)).toDecimalPlaces(
        2,
        Prisma.Decimal.ROUND_HALF_UP,
      );

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amount: total,
          balanceDue: total.minus(invoice.amountPaid),
        },
      });

      return { kind: 'ok' as const, lineItem };
    });

    if (result.kind === 'notFound') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (result.kind === 'notDraft') {
      return NextResponse.json(
        { error: 'Line items can only be added to a draft invoice' },
        { status: 409 },
      );
    }

    return NextResponse.json({ lineItem: result.lineItem }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}