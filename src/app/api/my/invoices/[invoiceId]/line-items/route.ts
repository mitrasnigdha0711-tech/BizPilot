import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: { invoiceId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (String(user.role).toLowerCase() !== 'freelance_video_editor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;

  const description =
    typeof raw.description === 'string' ? raw.description.trim() : '';
  if (!description) {
    return NextResponse.json(
      { error: 'Each line item needs a description.' },
      { status: 400 },
    );
  }

  const quantityNum =
    raw.quantity === undefined || raw.quantity === null
      ? 1
      : Number(raw.quantity);
  const unitPriceNum =
    raw.unitPrice === undefined || raw.unitPrice === null
      ? NaN
      : Number(raw.unitPrice);

  if (
    !Number.isFinite(quantityNum) ||
    quantityNum <= 0 ||
    !Number.isFinite(unitPriceNum) ||
    unitPriceNum < 0
  ) {
    return NextResponse.json(
      {
        error:
          'Quantity must be greater than 0 and unit price cannot be negative.',
      },
      { status: 400 },
    );
  }

  const quantity = new Prisma.Decimal(quantityNum).toDecimalPlaces(2);
  const unitPrice = new Prisma.Decimal(unitPriceNum).toDecimalPlaces(2);
  const amount = quantity.mul(unitPrice).toDecimalPlaces(2);

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, userId: user.id },
      select: { id: true, status: true, amountPaid: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (invoice.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Line items can only be added to draft invoices' },
        { status: 409 },
      );
    }

    const lineItem = await prisma.$transaction(async (tx) => {
      const created = await tx.invoiceLineItem.create({
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
      );

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amount: total,
          balanceDue: total.minus(invoice.amountPaid).toDecimalPlaces(2),
        },
      });

      return created;
    });

    return NextResponse.json({ invoiceLineItem: lineItem }, { status: 201 });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2025'
    ) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}