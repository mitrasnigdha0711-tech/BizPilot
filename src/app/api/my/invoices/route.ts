import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const FREELANCE_ROLE = 'FREELANCE_VIDEO_EDITOR';
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type LineInput = { description: string; quantity: number; unitPrice: number };

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function todayDay(): string {
  return new Date().toLocaleDateString('en-CA');
}

function parseDay(value: unknown): string | null {
  if (typeof value !== 'string' || !DAY_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === value ? value : null;
}

function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function parseLineItems(raw: unknown): { error: string } | { items: LineInput[] } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'An invoice must contain at least one line item.' };
  }
  const items: LineInput[] = [];
  for (const entry of raw) {
    const row = (entry ?? {}) as Record<string, unknown>;
    const description = typeof row.description === 'string' ? row.description.trim() : '';
    if (!description) {
      return { error: 'Each line item needs a description.' };
    }
    const quantity = row.quantity === undefined ? 1 : Number(row.quantity);
    const unitPrice = Number(row.unitPrice);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      return { error: 'Quantity must be greater than 0 and unit price cannot be negative.' };
    }
    items.push({ description, quantity, unitPrice });
  }
  return { items };
}

function deriveStatus(
  storedStatus: string,
  amountPaid: number,
  balanceDue: number,
  dueDay: string,
  today: string,
): string {
  if (storedStatus === 'DRAFT') return 'draft';
  if (balanceDue <= 0) return 'paid';
  if (amountPaid > 0) return 'partially_paid';
  if (dueDay < today) return 'overdue';
  return 'sent';
}

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
  if (!me || me.role !== FREELANCE_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const rows = await prisma.invoice.findMany({
      where: { userId: user.id },
      include: {
        payments: { select: { amount: true } },
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const today = todayDay();

    const invoices = rows.map((inv) => {
      const amount = round2(Number(inv.amount));
      const amountPaid = round2(inv.payments.reduce((sum, p) => sum + Number(p.amount), 0));
      const balanceDue = round2(amount - amountPaid);
      const dueDay = inv.dueDate.toISOString().slice(0, 10);
      const status = deriveStatus(inv.status, amountPaid, balanceDue, dueDay, today);
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientId: inv.clientId,
        projectId: inv.projectId,
        client: inv.client,
        project: inv.project,
        status,
        issueDate: inv.issueDate.toISOString().slice(0, 10),
        dueDate: dueDay,
        amount,
        amountPaid,
        balanceDue,
        createdAt: inv.createdAt,
        updatedAt: inv.updatedAt,
      };
    });

    invoices.sort((a, b) => {
      const rankA = a.status === 'overdue' ? 0 : 1;
      const rankB = b.status === 'overdue' ? 0 : 1;
      if (rankA !== rankB) return rankA - rankB;
      return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
    });

    return NextResponse.json({ invoices });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, businessId: true },
  });
  if (!me || me.role !== FREELANCE_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const clientId = typeof body.clientId === 'string' ? body.clientId : '';
  if (!clientId) {
    return NextResponse.json({ error: 'Please select a client.' }, { status: 400 });
  }

  const projectId = typeof body.projectId === 'string' && body.projectId ? body.projectId : null;

  const issueDay = body.issueDate === undefined ? todayDay() : parseDay(body.issueDate);
  if (!issueDay) {
    return NextResponse.json({ error: 'Please enter a valid issue date.' }, { status: 400 });
  }

  const dueDay = parseDay(body.dueDate);
  if (!dueDay || dueDay < issueDay) {
    return NextResponse.json(
      { error: 'Please enter a valid due date on or after the issue date.' },
      { status: 400 },
    );
  }

  const parsedItems = parseLineItems(body.lineItems);
  if ('error' in parsedItems) {
    return NextResponse.json({ error: parsedItems.error }, { status: 400 });
  }
  const items = parsedItems.items.map((item) => ({
    ...item,
    amount: round2(item.quantity * item.unitPrice),
  }));
  const total = round2(items.reduce((sum, item) => sum + item.amount, 0));

  if (!me.businessId) {
    return NextResponse.json(
      { error: 'Complete business setup before creating invoices.' },
      { status: 400 },
    );
  }
  const businessId = me.businessId;

  try {
    const client = await prisma.client.findFirst({
      where: { id: clientId, businessId },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json({ error: 'Please select a client.' }, { status: 400 });
    }

    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, clientId, businessId },
        select: { id: true },
      });
      if (!project) {
        return NextResponse.json(
          { error: 'Please select a project for this client.' },
          { status: 400 },
        );
      }
    }

    let invoice = null;
    for (let attempt = 0; attempt < 5 && !invoice; attempt++) {
      const count = await prisma.invoice.count({ where: { businessId } });
      const invoiceNumber = `INV-${String(count + 1 + attempt).padStart(5, '0')}`;
      try {
        invoice = await prisma.invoice.create({
          data: {
            invoiceNumber,
            clientId,
            projectId,
            status: 'DRAFT',
            issueDate: dayToDate(issueDay),
            dueDate: dayToDate(dueDay),
            amount: total,
            amountPaid: 0,
            balanceDue: total,
            businessId,
            userId: user.id,
            lineItems: {
              create: items.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                amount: item.amount,
              })),
            },
          },
          include: { lineItems: true },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          continue;
        }
        throw e;
      }
    }

    if (!invoice) {
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }

    return NextResponse.json(
      {
        invoice: {
          ...invoice,
          amount: Number(invoice.amount),
          amountPaid: Number(invoice.amountPaid),
          balanceDue: Number(invoice.balanceDue),
          issueDate: invoice.issueDate.toISOString().slice(0, 10),
          dueDate: invoice.dueDate.toISOString().slice(0, 10),
          status: 'draft',
          lineItems: invoice.lineItems.map((li) => ({
            ...li,
            quantity: Number(li.quantity),
            unitPrice: Number(li.unitPrice),
            amount: Number(li.amount),
          })),
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}