import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const ROLE = 'freelance_video_editor';
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const detailInclude = {
  lineItems: { orderBy: { createdAt: 'asc' } },
  payments: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.InvoiceInclude;

type InvoiceDetail = Prisma.InvoiceGetPayload<{ include: typeof detailInclude }>;

function money(value: Prisma.Decimal | number | string): number {
  return Number(value.toString());
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  const date = DAY_RE.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function serializeInvoice(invoice: InvoiceDetail) {
  return {
    ...invoice,
    amount: money(invoice.amount),
    amountPaid: money(invoice.amountPaid),
    balanceDue: money(invoice.balanceDue),
    lineItems: invoice.lineItems.map((item) => ({
      ...item,
      quantity: money(item.quantity),
      unitPrice: money(item.unitPrice),
      amount: money(item.amount),
    })),
    payments: invoice.payments.map((payment) => ({
      ...payment,
      amount: money(payment.amount),
    })),
  };
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(
  request: Request,
  { params }: { params: { invoiceId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (user.role !== ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { invoiceId } = params;
  if (!UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, userId: user.id },
      include: detailInclude,
    });
    if (!invoice) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ invoice: serializeInvoice(invoice) });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { invoiceId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (user.role !== ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return badRequest('Request body must be a JSON object');
  }
  const input = body as Record<string, unknown>;

  try {
    const existing = await prisma.invoice.findFirst({
      where: { id: invoiceId, userId: user.id },
      include: { lineItems: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const data: Prisma.InvoiceUncheckedUpdateInput = {};

    // Client: must belong to the caller.
    let clientId = existing.clientId;
    if ('clientId' in input) {
      if (typeof input.clientId !== 'string' || !UUID_RE.test(input.clientId)) {
        return badRequest('Please select a client.');
      }
      const client = await prisma.client.findFirst({
        where: { id: input.clientId, userId: user.id },
        select: { id: true },
      });
      if (!client) {
        return badRequest('Please select a client.');
      }
      clientId = client.id;
      data.clientId = clientId;
    }

    // Project: must exist for the caller and belong to the chosen client.
    let projectId = existing.projectId;
    if ('projectId' in input) {
      if (input.projectId === null || input.projectId === '') {
        projectId = null;
      } else if (typeof input.projectId === 'string' && UUID_RE.test(input.projectId)) {
        projectId = input.projectId;
      } else {
        return badRequest('Please select a project for this client.');
      }
      data.projectId = projectId;
    }
    if (projectId !== null) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, clientId, userId: user.id },
        select: { id: true },
      });
      if (!project) {
        return badRequest('Please select a project for this client.');
      }
    }

    // Dates: due date must be a valid day on or after the issue date.
    let issueDate = existing.issueDate;
    if ('issueDate' in input) {
      const parsed = parseDay(input.issueDate);
      if (!parsed) return badRequest('Please enter a valid issue date.');
      issueDate = parsed;
      data.issueDate = parsed;
    }
    let dueDate = existing.dueDate;
    if ('dueDate' in input) {
      const parsed = parseDay(input.dueDate);
      if (!parsed) {
        return badRequest('Please enter a valid due date on or after the issue date.');
      }
      dueDate = parsed;
      data.dueDate = parsed;
    }
    if (dueDate.getTime() < issueDate.getTime()) {
      return badRequest('Please enter a valid due date on or after the issue date.');
    }

    // Totals: recomputed from line items, never below what is already paid.
    const total = round2(
      existing.lineItems.reduce((sum, item) => sum + money(item.amount), 0),
    );
    const paid = round2(money(existing.amountPaid));
    if (total < paid) {
      return badRequest('Amount cannot drop below the amount already paid.');
    }
    data.amount = total;
    data.balanceDue = round2(total - paid);

    const invoice = await prisma.invoice.update({
      where: { id: existing.id },
      data,
      include: detailInclude,
    });

    return NextResponse.json({ invoice: serializeInvoice(invoice) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { invoiceId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (user.role !== ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { invoiceId } = params;
  if (!UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const existing = await prisma.invoice.findFirst({
      where: { id: invoiceId, userId: user.id },
      include: {
        _count: {
          select: { payments: true, reminders: true, insights: true, simulations: true },
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const hasLinkedRecords =
      existing._count.payments > 0 ||
      existing._count.reminders > 0 ||
      existing._count.insights > 0 ||
      existing._count.simulations > 0;

    if (existing.status !== 'DRAFT' || money(existing.amountPaid) > 0 || hasLinkedRecords) {
      return NextResponse.json(
        { error: 'Only draft invoices with no payments can be deleted' },
        { status: 409 },
      );
    }

    await prisma.invoice.delete({ where: { id: existing.id } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      if (e.code === 'P2003') {
        return NextResponse.json(
          { error: 'Invoice is linked to other records' },
          { status: 409 },
        );
      }
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}