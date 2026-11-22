import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const FREELANCE_ROLE = 'freelance_video_editor';

type RouteContext = { params: { invoiceId: string; lineItemId: string } };

type EditableFields = {
  description?: string;
  quantity?: number;
  unitPrice?: number;
};

type TxResult =
  | { kind: 'ok'; lineItem: Prisma.InvoiceLineItemGetPayload<object> }
  | { kind: 'notFound'; message: string }
  | { kind: 'conflict'; message: string };

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isFreelanceEditor(role: unknown): boolean {
  return String(role ?? '').toLowerCase() === FREELANCE_ROLE;
}

function parseEditableFields(
  body: unknown,
): { ok: true; data: EditableFields } | { ok: false; message: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, message: 'Request body must be a JSON object' };
  }
  const input = body as Record<string, unknown>;
  const data: EditableFields = {};

  if (input.description !== undefined) {
    if (typeof input.description !== 'string' || input.description.trim() === '') {
      return { ok: false, message: 'Each line item needs a description.' };
    }
    data.description = input.description.trim();
  }

  if (input.quantity !== undefined) {
    if (!isFiniteNumber(input.quantity) || input.quantity <= 0) {
      return {
        ok: false,
        message: 'Quantity must be greater than 0 and unit price cannot be negative.',
      };
    }
    data.quantity = input.quantity;
  }

  if (input.unitPrice !== undefined) {
    if (!isFiniteNumber(input.unitPrice) || input.unitPrice < 0) {
      return {
        ok: false,
        message: 'Quantity must be greater than 0 and unit price cannot be negative.',
      };
    }
    data.unitPrice = input.unitPrice;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, message: 'No editable fields provided' };
  }

  return { ok: true, data };
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (!isFreelanceEditor(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = parseEditableFields(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }
  const changes = parsed.data;

  try {
    const result: TxResult = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: params.invoiceId, userId: user.id },
      });
      if (!invoice) {
        return { kind: 'notFound', message: 'Invoice not found' };
      }

      if (invoice.status !== 'DRAFT') {
        return {
          kind: 'conflict',
          message: 'Line items can only be edited while the invoice is a draft',
        };
      }

      const existing = await tx.invoiceLineItem.findFirst({
        where: { id: params.lineItemId, invoiceId: invoice.id },
      });
      if (!existing) {
        return { kind: 'notFound', message: 'Line item not found' };
      }

      const quantity = changes.quantity ?? existing.quantity.toNumber();
      const unitPrice = changes.unitPrice ?? existing.unitPrice.toNumber();
      const lineAmount = roundMoney(quantity * unitPrice);

      const lineItem = await tx.invoiceLineItem.update({
        where: { id: existing.id },
        data: {
          ...(changes.description !== undefined ? { description: changes.description } : {}),
          quantity,
          unitPrice,
          amount: lineAmount,
        },
      });

      const siblings = await tx.invoiceLineItem.findMany({
        where: { invoiceId: invoice.id },
        select: { amount: true },
      });
      const total = roundMoney(
        siblings.reduce((sum, row) => sum + row.amount.toNumber(), 0),
      );
      const amountPaid = invoice.amountPaid.toNumber();

      if (total < amountPaid) {
        return {
          kind: 'conflict',
          message: 'Invoice amount cannot drop below the amount already paid',
        };
      }

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amount: total,
          balanceDue: roundMoney(total - amountPaid),
        },
      });

      return { kind: 'ok', lineItem };
    });

    if (result.kind === 'notFound') {
      return NextResponse.json({ error: result.message }, { status: 404 });
    }
    if (result.kind === 'conflict') {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }
    return NextResponse.json({ invoiceLineItem: result.lineItem });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (!isFreelanceEditor(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result: { kind: 'ok' } | { kind: 'notFound'; message: string } | { kind: 'conflict'; message: string } =
      await prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.findFirst({
          where: { id: params.invoiceId, userId: user.id },
        });
        if (!invoice) {
          return { kind: 'notFound', message: 'Invoice not found' };
        }

        if (invoice.status !== 'DRAFT') {
          return {
            kind: 'conflict',
            message: 'Line items can only be removed while the invoice is a draft',
          };
        }

        const existing = await tx.invoiceLineItem.findFirst({
          where: { id: params.lineItemId, invoiceId: invoice.id },
        });
        if (!existing) {
          return { kind: 'notFound', message: 'Line item not found' };
        }

        await tx.invoiceLineItem.delete({ where: { id: existing.id } });

        const remaining = await tx.invoiceLineItem.findMany({
          where: { invoiceId: invoice.id },
          select: { amount: true },
        });
        const total = roundMoney(
          remaining.reduce((sum, row) => sum + row.amount.toNumber(), 0),
        );
        const amountPaid = invoice.amountPaid.toNumber();

        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            amount: total,
            balanceDue: roundMoney(total - amountPaid),
          },
        });

        return { kind: 'ok' };
      });

    if (result.kind === 'notFound') {
      return NextResponse.json({ error: result.message }, { status: 404 });
    }
    if (result.kind === 'conflict') {
      return NextResponse.json({ error: result.message }, { status: 409 });
    }
    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}