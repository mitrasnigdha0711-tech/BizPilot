import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
  return d;
}

function generateInvoiceNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(3).toString('hex').toUpperCase();
  return `INV-${stamp}-${rand}`;
}

interface LineItemInput {
  description?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
}

interface CreateInvoiceBody {
  clientId?: unknown;
  projectId?: unknown;
  issueDate?: unknown;
  dueDate?: unknown;
  lineItems?: unknown;
}

async function getOwnerContext(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return { error: user as Response };

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, role: true, businessId: true },
  });
  if (!dbUser) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (dbUser.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  if (!dbUser.businessId) {
    return { error: NextResponse.json({ error: 'No business linked to this account' }, { status: 403 }) };
  }
  return { userId: dbUser.id, businessId: dbUser.businessId };
}

export async function GET(request: Request) {
  try {
    const ctx = await getOwnerContext(request);
    if ('error' in ctx) return ctx.error;

    const rows = await prisma.invoice.findMany({
      where: { businessId: ctx.businessId },
      orderBy: [{ dueDate: 'asc' }, { invoiceNumber: 'asc' }],
    });

    // Overdue invoices surface first, then by due date ascending.
    const invoices = [...rows].sort((a, b) => {
      const aRank = a.status === 'OVERDUE' ? 0 : 1;
      const bRank = b.status === 'OVERDUE' ? 0 : 1;
      if (aRank !== bRank) return aRank - bRank;
      return a.dueDate.getTime() - b.dueDate.getTime();
    });

    return NextResponse.json({ invoices });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: CreateInvoiceBody;
  try {
    body = (await request.json()) as CreateInvoiceBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const ctx = await getOwnerContext(request);
    if ('error' in ctx) return ctx.error;

    const clientId = typeof body.clientId === 'string' ? body.clientId : '';
    if (!clientId || !UUID_RE.test(clientId)) {
      return NextResponse.json({ error: 'Please select a client.' }, { status: 400 });
    }

    const projectId =
      typeof body.projectId === 'string' && body.projectId.length > 0 ? body.projectId : null;
    if (projectId !== null && !UUID_RE.test(projectId)) {
      return NextResponse.json({ error: 'Please select a project for this client.' }, { status: 400 });
    }

    const issueDate = parseDay(body.issueDate);
    const dueDate = parseDay(body.dueDate);
    if (!issueDate) {
      return NextResponse.json({ error: 'Issue date must be a valid date (YYYY-MM-DD).' }, { status: 400 });
    }
    if (!dueDate || dueDate.getTime() < issueDate.getTime()) {
      return NextResponse.json(
        { error: 'Please enter a valid due date on or after the issue date.' },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.lineItems) || body.lineItems.length === 0) {
      return NextResponse.json(
        { error: 'An invoice needs at least one line item.' },
        { status: 400 },
      );
    }

    const lines: { description: string; quantity: number; unitPrice: number; cents: number }[] = [];
    for (const raw of body.lineItems as LineItemInput[]) {
      const description = typeof raw?.description === 'string' ? raw.description.trim() : '';
      if (!description) {
        return NextResponse.json({ error: 'Each line item needs a description.' }, { status: 400 });
      }
      const quantity = raw.quantity === undefined ? 1 : Number(raw.quantity);
      const unitPrice = Number(raw.unitPrice);
      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
        return NextResponse.json(
          { error: 'Quantity must be greater than 0 and unit price cannot be negative.' },
          { status: 400 },
        );
      }
      lines.push({
        description,
        quantity,
        unitPrice,
        cents: Math.round(quantity * unitPrice * 100),
      });
    }

    const client = await prisma.client.findFirst({
      where: { id: clientId, businessId: ctx.businessId },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (projectId !== null) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, clientId: client.id, businessId: ctx.businessId },
        select: { id: true },
      });
      if (!project) {
        return NextResponse.json({ error: 'Please select a project for this client.' }, { status: 400 });
      }
    }

    const totalCents = lines.reduce((sum, l) => sum + l.cents, 0);
    const amount = (totalCents / 100).toFixed(2);

    let invoice = null;
    for (let attempt = 0; attempt < 3 && !invoice; attempt++) {
      try {
        invoice = await prisma.invoice.create({
          data: {
            invoiceNumber: generateInvoiceNumber(),
            clientId: client.id,
            projectId,
            status: 'DRAFT',
            issueDate,
            dueDate,
            amount,
            amountPaid: '0.00',
            balanceDue: amount,
            businessId: ctx.businessId,
            userId: ctx.userId,
            lineItems: {
              create: lines.map((l) => ({
                description: l.description,
                quantity: l.quantity.toFixed(2),
                unitPrice: l.unitPrice.toFixed(2),
                amount: (l.cents / 100).toFixed(2),
              })),
            },
          },
          include: { lineItems: true },
        });
      } catch (e) {
        const isUniqueClash =
          typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === 'P2002';
        if (!isUniqueClash || attempt === 2) throw e;
      }
    }

    return NextResponse.json({ invoice }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}