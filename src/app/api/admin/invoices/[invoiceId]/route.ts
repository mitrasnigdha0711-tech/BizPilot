import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const OWNER_ROLE = 'small_video_editing_business_owner';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

type Ctx = { params: { invoiceId: string } };
type OwnerResult = { response: Response } | { businessId: string | null };

function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function resolveOwner(request: Request): Promise<OwnerResult> {
  const user = await requireUser(request);
  if (user instanceof Response) return { response: user };
  if (String(user.role).toLowerCase() !== OWNER_ROLE) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { businessId: true },
  });
  return { businessId: dbUser?.businessId ?? null };
}

function isNotFound(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025';
}

export async function GET(request: Request, { params }: Ctx) {
  const owner = await resolveOwner(request);
  if ('response' in owner) return owner.response;

  const invoiceId = params.invoiceId;
  if (!UUID_RE.test(invoiceId) || !owner.businessId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, businessId: owner.businessId },
      include: {
        lineItems: true,
        payments: true,
      },
    });
    if (!invoice) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ invoice });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  const owner = await resolveOwner(request);
  if ('response' in owner) return owner.response;

  const invoiceId = params.invoiceId;
  if (!UUID_RE.test(invoiceId) || !owner.businessId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const businessId = owner.businessId;

  try {
    const existing = await prisma.invoice.findFirst({
      where: { id: invoiceId, businessId },
      select: { id: true, clientId: true, projectId: true, issueDate: true, dueDate: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const data: Prisma.InvoiceUpdateInput = {};
    let nextClientId = existing.clientId;
    let nextProjectId: string | null = existing.projectId;

    if (input.clientId !== undefined) {
      if (typeof input.clientId !== 'string' || !UUID_RE.test(input.clientId)) {
        return NextResponse.json({ error: 'Please select a client.' }, { status: 400 });
      }
      const client = await prisma.client.findFirst({
        where: { id: input.clientId, businessId },
        select: { id: true },
      });
      if (!client) {
        return NextResponse.json({ error: 'Please select a client.' }, { status: 400 });
      }
      nextClientId = client.id;
      data.client = { connect: { id: client.id } };
      if (input.projectId === undefined && existing.projectId) {
        nextProjectId = null;
        data.project = { disconnect: true };
      }
    }

    if (input.projectId !== undefined) {
      if (input.projectId === null) {
        nextProjectId = null;
        data.project = { disconnect: true };
      } else {
        if (typeof input.projectId !== 'string' || !UUID_RE.test(input.projectId)) {
          return NextResponse.json(
            { error: 'Please select a project for this client.' },
            { status: 400 },
          );
        }
        const project = await prisma.project.findFirst({
          where: { id: input.projectId, businessId, clientId: nextClientId },
          select: { id: true },
        });
        if (!project) {
          return NextResponse.json(
            { error: 'Please select a project for this client.' },
            { status: 400 },
          );
        }
        nextProjectId = project.id;
        data.project = { connect: { id: project.id } };
      }
    }

    let nextIssue = existing.issueDate;
    let nextDue = existing.dueDate;

    if (input.issueDate !== undefined) {
      const issue = parseDay(input.issueDate);
      if (!issue) {
        return NextResponse.json({ error: 'Invalid issue date' }, { status: 400 });
      }
      nextIssue = issue;
      data.issueDate = issue;
    }

    if (input.dueDate !== undefined) {
      const due = parseDay(input.dueDate);
      if (!due) {
        return NextResponse.json(
          { error: 'Please enter a valid due date on or after the issue date.' },
          { status: 400 },
        );
      }
      nextDue = due;
      data.dueDate = due;
    }

    if (nextDue.getTime() < nextIssue.getTime()) {
      return NextResponse.json(
        { error: 'Please enter a valid due date on or after the issue date.' },
        { status: 400 },
      );
    }

    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data,
      include: {
        lineItems: true,
        payments: true,
      },
    });

    return NextResponse.json({ invoice });
  } catch (e) {
    if (isNotFound(e)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  const owner = await resolveOwner(request);
  if ('response' in owner) return owner.response;

  const invoiceId = params.invoiceId;
  if (!UUID_RE.test(invoiceId) || !owner.businessId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const businessId = owner.businessId;

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, businessId },
      select: { id: true, status: true, _count: { select: { payments: true } } },
    });
    if (!invoice) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (invoice.status !== 'DRAFT' || invoice._count.payments > 0) {
      return NextResponse.json(
        { error: 'Only draft invoices with no payments can be deleted' },
        { status: 409 },
      );
    }

    await prisma.invoice.delete({ where: { id: invoiceId } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (isNotFound(e)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}