import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

type Role = 'FREELANCE_VIDEO_EDITOR' | 'SMALL_VIDEO_EDITING_BUSINESS_OWNER';

type Scope = {
  role: Role;
  userId: string;
  businessId: string | null;
};

async function loadScope(request: Request): Promise<Scope | Response> {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, role: true, businessId: true, isActive: true },
  });
  if (!me || !me.isActive) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (me.role !== 'FREELANCE_VIDEO_EDITOR' && me.role !== 'SMALL_VIDEO_EDITING_BUSINESS_OWNER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let businessId = me.businessId;
  if (me.role === 'SMALL_VIDEO_EDITING_BUSINESS_OWNER' && !businessId) {
    const owned = await prisma.business.findFirst({
      where: { userId: me.id },
      select: { id: true },
    });
    businessId = owned?.id ?? null;
  }

  return { role: me.role, userId: me.id, businessId };
}

// Scope the invoice lookup: freelancers see only their own invoices (own_only),
// owners see every invoice in their business. Returns null when the caller can
// never match a row, so the handler answers 404.
function invoiceWhere(scope: Scope, invoiceId: string): Prisma.InvoiceWhereInput | null {
  if (scope.role === 'FREELANCE_VIDEO_EDITOR') {
    return { id: invoiceId, userId: scope.userId };
  }
  if (!scope.businessId) return null;
  return { id: invoiceId, businessId: scope.businessId };
}

function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
  return d;
}

function toDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayDay(request: Request): string {
  const q = new URL(request.url).searchParams.get('date');
  if (q && parseDay(q)) return q;
  return new Date().toLocaleDateString('en-CA');
}

function handleError(e: unknown): Response {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  console.error(e);
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}

export async function GET(
  request: Request,
  { params }: { params: { invoiceId: string } }
) {
  try {
    const scope = await loadScope(request);
    if (scope instanceof Response) return scope;

    if (!UUID_RE.test(params.invoiceId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const where = invoiceWhere(scope, params.invoiceId);
    if (!where) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const invoice = await prisma.invoice.findFirst({
      where,
      include: {
        lineItems: { orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { createdAt: 'asc' } },
        client: true,
        project: true,
      },
    });
    if (!invoice) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Shown as overdue when the due date has passed while a balance remains.
    const today = todayDay(request);
    const dueDay = toDay(invoice.dueDate);
    const isOverdue =
      (invoice.status === 'SENT' || invoice.status === 'PARTIALLY_PAID') &&
      Number(invoice.balanceDue) > 0 &&
      dueDay < today;

    return NextResponse.json({
      invoice: {
        ...invoice,
        status: isOverdue ? 'OVERDUE' : invoice.status,
        issueDate: toDay(invoice.issueDate),
        dueDate: dueDay,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { invoiceId: string } }
) {
  try {
    const scope = await loadScope(request);
    if (scope instanceof Response) return scope;

    if (!UUID_RE.test(params.invoiceId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const where = invoiceWhere(scope, params.invoiceId);
    if (!where) {
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
    const b = body as Record<string, unknown>;

    const invoice = await prisma.invoice.findFirst({ where });
    if (!invoice) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Edits are allowed only while draft, sent or partially paid.
    if (!['DRAFT', 'SENT', 'PARTIALLY_PAID'].includes(invoice.status)) {
      return NextResponse.json(
        { error: 'This invoice can no longer be edited' },
        { status: 409 }
      );
    }

    const data: Prisma.InvoiceUncheckedUpdateInput = {};

    // Client
    let effectiveClientId = invoice.clientId;
    if ('clientId' in b) {
      if (typeof b.clientId !== 'string' || !UUID_RE.test(b.clientId)) {
        return NextResponse.json({ error: 'Please select a client.' }, { status: 400 });
      }
      const client = await prisma.client.findFirst({
        where: { id: b.clientId, businessId: invoice.businessId },
        select: { id: true },
      });
      if (!client) {
        return NextResponse.json({ error: 'Please select a client.' }, { status: 400 });
      }
      effectiveClientId = client.id;
      data.clientId = client.id;
    }

    // Dates
    let effectiveIssue = invoice.issueDate;
    let effectiveDue = invoice.dueDate;
    if ('issueDate' in b) {
      const parsed = parseDay(b.issueDate);
      if (!parsed) {
        return NextResponse.json(
          { error: 'Please enter a valid due date on or after the issue date.' },
          { status: 400 }
        );
      }
      effectiveIssue = parsed;
      data.issueDate = parsed;
    }
    if ('dueDate' in b) {
      const parsed = parseDay(b.dueDate);
      if (!parsed) {
        return NextResponse.json(
          { error: 'Please enter a valid due date on or after the issue date.' },
          { status: 400 }
        );
      }
      effectiveDue = parsed;
      data.dueDate = parsed;
    }
    if (effectiveDue.getTime() < effectiveIssue.getTime()) {
      return NextResponse.json(
        { error: 'Please enter a valid due date on or after the issue date.' },
        { status: 400 }
      );
    }

    // Project must belong to the (effective) client
    const clientChanged = effectiveClientId !== invoice.clientId;
    if ('projectId' in b) {
      if (b.projectId === null) {
        data.projectId = null;
      } else {
        if (typeof b.projectId !== 'string' || !UUID_RE.test(b.projectId)) {
          return NextResponse.json(
            { error: 'Please select a project for this client.' },
            { status: 400 }
          );
        }
        const project = await prisma.project.findFirst({
          where: { id: b.projectId, businessId: invoice.businessId },
          select: { id: true, clientId: true },
        });
        if (!project || project.clientId !== effectiveClientId) {
          return NextResponse.json(
            { error: 'Please select a project for this client.' },
            { status: 400 }
          );
        }
        data.projectId = project.id;
      }
    } else if (clientChanged && invoice.projectId) {
      const current = await prisma.project.findFirst({
        where: { id: invoice.projectId },
        select: { clientId: true },
      });
      if (!current || current.clientId !== effectiveClientId) {
        return NextResponse.json(
          { error: 'Please select a project for this client.' },
          { status: 400 }
        );
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({
        invoice: {
          ...invoice,
          issueDate: toDay(invoice.issueDate),
          dueDate: toDay(invoice.dueDate),
        },
      });
    }

    const updated = await prisma.invoice.update({
      where: { id: invoice.id },
      data,
    });

    return NextResponse.json({
      invoice: {
        ...updated,
        issueDate: toDay(updated.issueDate),
        dueDate: toDay(updated.dueDate),
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { invoiceId: string } }
) {
  try {
    const scope = await loadScope(request);
    if (scope instanceof Response) return scope;

    if (!UUID_RE.test(params.invoiceId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const where = invoiceWhere(scope, params.invoiceId);
    if (!where) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const invoice = await prisma.invoice.findFirst({ where });
    if (!invoice) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const paymentCount = await prisma.payment.count({
      where: { invoiceId: invoice.id },
    });
    if (invoice.status !== 'DRAFT' || paymentCount > 0) {
      return NextResponse.json(
        { error: 'Only draft invoices with no payments can be deleted' },
        { status: 409 }
      );
    }

    await prisma.invoice.delete({ where: { id: invoice.id } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}