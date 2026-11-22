import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { InvoiceStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
  return d;
}

interface LineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

function parseLineItems(raw: unknown): { items: LineItemInput[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'Each line item needs a description.' };
  }
  const items: LineItemInput[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') {
      return { error: 'Each line item needs a description.' };
    }
    const r = row as Record<string, unknown>;
    const description = typeof r.description === 'string' ? r.description.trim() : '';
    if (!description) {
      return { error: 'Each line item needs a description.' };
    }
    const quantity = r.quantity === undefined ? 1 : Number(r.quantity);
    const unitPrice = Number(r.unitPrice);
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(unitPrice) ||
      unitPrice < 0
    ) {
      return { error: 'Quantity must be greater than 0 and unit price cannot be negative.' };
    }
    items.push({ description, quantity, unitPrice });
  }
  return { items };
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const caller = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, businessId: true },
    });
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const isFreelancer = caller.role === Role.FREELANCE_VIDEO_EDITOR;
    const isOwner = caller.role === Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER;
    if (!isFreelancer && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!caller.businessId) {
      return NextResponse.json(
        { error: 'Set up your business before creating invoices' },
        { status: 400 },
      );
    }
    const businessId = caller.businessId;

    // Client must be selected and belong to the caller's business (and to the caller when freelancing)
    const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
    if (!clientId) {
      return NextResponse.json({ error: 'Please select a client.' }, { status: 400 });
    }
    const client = await prisma.client.findFirst({
      where: {
        id: clientId,
        businessId,
        ...(isFreelancer ? { userId: user.id } : {}),
      },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json({ error: 'Please select a client.' }, { status: 400 });
    }

    // Optional project must belong to the chosen client
    const rawProjectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
    let projectId: string | null = null;
    if (rawProjectId) {
      const project = await prisma.project.findFirst({
        where: { id: rawProjectId, clientId: client.id, businessId },
        select: { id: true },
      });
      if (!project) {
        return NextResponse.json(
          { error: 'Please select a project for this client.' },
          { status: 400 },
        );
      }
      projectId = project.id;
    }

    // Dates
    const issueDate = parseDay(body.issueDate);
    if (!issueDate) {
      return NextResponse.json(
        { error: 'Please enter a valid due date on or after the issue date.' },
        { status: 400 },
      );
    }
    const dueDate = parseDay(body.dueDate);
    if (!dueDate || dueDate.getTime() < issueDate.getTime()) {
      return NextResponse.json(
        { error: 'Please enter a valid due date on or after the issue date.' },
        { status: 400 },
      );
    }

    // Line items
    const parsedItems = parseLineItems(body.lineItems);
    if ('error' in parsedItems) {
      return NextResponse.json({ error: parsedItems.error }, { status: 400 });
    }
    const lineItemRows = parsedItems.items.map((item) => {
      const quantity = new Prisma.Decimal(item.quantity);
      const unitPrice = new Prisma.Decimal(item.unitPrice);
      return {
        description: item.description,
        quantity,
        unitPrice,
        amount: quantity.times(unitPrice).toDecimalPlaces(2),
      };
    });
    const amount = lineItemRows
      .reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(0))
      .toDecimalPlaces(2);

    // Status: starts as draft or sent; overdue at once when due date is already past
    const todayRaw =
      new URL(request.url).searchParams.get('date') ?? new Date().toLocaleDateString('en-CA');
    const today = parseDay(todayRaw) ?? parseDay(new Date().toLocaleDateString('en-CA'));
    let status: InvoiceStatus = body.status === 'sent' ? InvoiceStatus.SENT : InvoiceStatus.DRAFT;
    if (today && dueDate.getTime() < today.getTime()) {
      status = InvoiceStatus.OVERDUE;
    }

    // Unique invoice number; retry on collision
    const year = issueDate.getUTCFullYear();
    for (let attempt = 0; attempt < 3; attempt++) {
      const invoiceNumber = `INV-${year}-${randomBytes(3).toString('hex').toUpperCase()}`;
      try {
        const invoice = await prisma.invoice.create({
          data: {
            invoiceNumber,
            clientId: client.id,
            projectId,
            status,
            issueDate,
            dueDate,
            amount,
            amountPaid: new Prisma.Decimal(0),
            balanceDue: amount,
            businessId,
            userId: user.id,
            lineItems: { create: lineItemRows },
          },
          include: { lineItems: true },
        });
        return NextResponse.json({ invoice }, { status: 201 });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          continue;
        }
        throw e;
      }
    }

    return NextResponse.json(
      { error: 'Could not allocate a unique invoice number' },
      { status: 409 },
    );
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}