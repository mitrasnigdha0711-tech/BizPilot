import { NextResponse } from 'next/server';
import { Prisma, type ProjectStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const WIRE_TO_STATUS: Record<string, ProjectStatus> = {
  planned: 'PLANNED',
  in_progress: 'IN_PROGRESS',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
};

const STATUS_TO_WIRE: Record<ProjectStatus, string> = {
  PLANNED: 'planned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

type ProjectCore = {
  id: string;
  name: string;
  clientId: string;
  status: ProjectStatus;
  startDate: Date | null;
  deadline: Date;
  value: Prisma.Decimal | null;
  completedAt: Date | null;
  businessId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
};

type InvoiceCore = {
  amount: Prisma.Decimal;
  amountPaid: Prisma.Decimal;
  balanceDue: Prisma.Decimal;
};

function toDay(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function serializeProject(p: ProjectCore) {
  return {
    id: p.id,
    name: p.name,
    clientId: p.clientId,
    status: STATUS_TO_WIRE[p.status],
    startDate: toDay(p.startDate),
    deadline: toDay(p.deadline),
    value: p.value === null ? null : Number(p.value),
    completedAt: p.completedAt ? p.completedAt.toISOString() : null,
    businessId: p.businessId,
    userId: p.userId,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function serializeInvoice<T extends InvoiceCore>(inv: T) {
  return {
    ...inv,
    amount: Number(inv.amount),
    amountPaid: Number(inv.amountPaid),
    balanceDue: Number(inv.balanceDue),
  };
}

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

function internalError() {
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}

function handleError(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
    return notFound();
  }
  return internalError();
}

async function authorize(request: Request): Promise<{ userId: string } | Response> {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
  if (!dbUser || dbUser.role !== 'FREELANCE_VIDEO_EDITOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return { userId: user.id };
}

function parseDay(value: string): Date | null {
  if (!DAY_RE.test(value)) return null;
  const d = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10) === value ? d : null;
}

function statusChangeError(from: ProjectStatus, to: ProjectStatus): string | null {
  if (from === to) return null;
  const terminalTarget = to === 'COMPLETED' || to === 'CANCELLED';
  if (terminalTarget) {
    return 'Use the complete or cancel action to change a project to completed or cancelled.';
  }
  if (from === 'COMPLETED' || from === 'CANCELLED') {
    return 'Completed or cancelled projects cannot be moved back to planned or in progress.';
  }
  return null;
}

export async function GET(request: Request, { params }: { params: { projectId: string } }) {
  const auth = await authorize(request);
  if (auth instanceof Response) return auth;

  const { projectId } = params;
  if (!UUID_RE.test(projectId)) return notFound();

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: auth.userId },
      include: { client: true, invoices: true },
    });
    if (!project) return notFound();

    return NextResponse.json({
      project: {
        ...serializeProject(project),
        client: project.client,
        invoices: project.invoices.map(serializeInvoice),
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(request: Request, { params }: { params: { projectId: string } }) {
  const auth = await authorize(request);
  if (auth instanceof Response) return auth;

  const { projectId } = params;
  if (!UUID_RE.test(projectId)) return notFound();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const input = body as Record<string, unknown>;

  try {
    const existing = await prisma.project.findFirst({
      where: { id: projectId, userId: auth.userId },
    });
    if (!existing) return notFound();

    const data: Prisma.ProjectUpdateInput = {};

    if ('name' in input) {
      if (typeof input.name !== 'string' || input.name.trim().length === 0 || input.name.trim().length > 120) {
        return NextResponse.json({ error: 'Enter a project name of up to 120 characters.' }, { status: 400 });
      }
      data.name = input.name.trim();
    }

    if ('clientId' in input) {
      if (typeof input.clientId !== 'string' || !UUID_RE.test(input.clientId)) {
        return NextResponse.json({ error: 'Please select a client for this project.' }, { status: 400 });
      }
      const client = await prisma.client.findFirst({
        where: { id: input.clientId, userId: auth.userId },
        select: { id: true },
      });
      if (!client) {
        return NextResponse.json({ error: 'Please select a client for this project.' }, { status: 400 });
      }
      data.client = { connect: { id: client.id } };
    }

    if ('status' in input) {
      const next = typeof input.status === 'string' ? WIRE_TO_STATUS[input.status] : undefined;
      if (!next) {
        return NextResponse.json(
          { error: 'Choose a valid status. Projects move from planning to in progress, then in review, then completed.' },
          { status: 400 },
        );
      }
      const transitionError = statusChangeError(existing.status, next);
      if (transitionError) {
        return NextResponse.json({ error: transitionError }, { status: 409 });
      }
      data.status = next;
      if (next === 'COMPLETED' && existing.status !== 'COMPLETED') {
        data.completedAt = new Date();
      }
    }

    if ('value' in input) {
      if (input.value === null) {
        data.value = null;
      } else if (typeof input.value !== 'number' || !Number.isFinite(input.value) || input.value < 0) {
        return NextResponse.json({ error: 'Please enter a project value of 0 or more.' }, { status: 400 });
      } else {
        data.value = input.value;
      }
    }

    let nextStart: Date | null | undefined;
    if ('startDate' in input) {
      if (input.startDate === null) {
        nextStart = null;
      } else {
        const parsed = typeof input.startDate === 'string' ? parseDay(input.startDate) : null;
        if (!parsed) {
          return NextResponse.json({ error: 'Enter a valid start date.' }, { status: 400 });
        }
        nextStart = parsed;
      }
      data.startDate = nextStart;
    }

    if ('deadline' in input) {
      if (existing.status === 'COMPLETED') {
        return NextResponse.json(
          { error: 'A completed project cannot change its deadline.' },
          { status: 409 },
        );
      }
      const parsed = typeof input.deadline === 'string' ? parseDay(input.deadline) : null;
      if (!parsed) {
        return NextResponse.json({ error: 'Please choose a deadline today or later.' }, { status: 400 });
      }
      data.deadline = parsed;
    }

    if ('deadline' in input || 'startDate' in input) {
      const effectiveDeadline = data.deadline instanceof Date ? data.deadline : existing.deadline;
      const effectiveStart = nextStart !== undefined ? nextStart : existing.startDate;
      if (effectiveStart && effectiveDeadline < effectiveStart) {
        return NextResponse.json(
          { error: 'Enter a deadline on or after the project start date.' },
          { status: 400 },
        );
      }
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data,
    });

    return NextResponse.json({ project: serializeProject(project) });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(request: Request, { params }: { params: { projectId: string } }) {
  const auth = await authorize(request);
  if (auth instanceof Response) return auth;

  const { projectId } = params;
  if (!UUID_RE.test(projectId)) return notFound();

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: auth.userId },
      select: { id: true, status: true },
    });
    if (!project) return notFound();

    if (project.status !== 'PLANNED' && project.status !== 'CANCELLED') {
      return NextResponse.json(
        { error: 'Only planned or cancelled projects can be deleted.' },
        { status: 409 },
      );
    }

    const invoiceCount = await prisma.invoice.count({ where: { projectId: project.id } });
    if (invoiceCount > 0) {
      return NextResponse.json(
        { error: 'This project has invoices linked. Cancel it instead.' },
        { status: 409 },
      );
    }

    await prisma.project.delete({ where: { id: project.id } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}