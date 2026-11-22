import { NextResponse } from 'next/server';
import { Prisma, ProjectStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

type RouteContext = { params: Promise<{ projectId: string }> };

type Scope = {
  userId: string;
  businessId: string | null;
  ownOnly: boolean;
};

const PROJECT_INCLUDE = {
  client: true,
  tasks: true,
  invoices: true,
} as const satisfies Prisma.ProjectInclude;

type ProjectWithRelations = Prisma.ProjectGetPayload<{ include: typeof PROJECT_INCLUDE }>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const WIRE_STATUS: Record<ProjectStatus, string> = {
  PLANNED: 'planned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

function parseStatus(value: unknown): ProjectStatus | null {
  switch (value) {
    case 'planned':
      return ProjectStatus.PLANNED;
    case 'in_progress':
      return ProjectStatus.IN_PROGRESS;
    case 'completed':
      return ProjectStatus.COMPLETED;
    case 'cancelled':
      return ProjectStatus.CANCELLED;
    default:
      return null;
  }
}

function fail(message: string, status: number): Response {
  return NextResponse.json({ error: message }, { status });
}

function notFound(): Response {
  return fail('Project not found', 404);
}

function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';
}

async function authorize(request: Request): Promise<Scope | Response> {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, businessId: true, isActive: true },
  });
  if (!me || !me.isActive) return fail('Not signed in', 401);

  if (me.role !== Role.FREELANCE_VIDEO_EDITOR && me.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
    return fail('Not available for your role', 403);
  }

  return {
    userId: user.id,
    businessId: me.businessId,
    ownOnly: me.role === Role.FREELANCE_VIDEO_EDITOR,
  };
}

function scopedWhere(scope: Scope, projectId: string): Prisma.ProjectWhereInput | null {
  if (!scope.businessId) return null;
  return {
    id: projectId,
    businessId: scope.businessId,
    ...(scope.ownOnly ? { userId: scope.userId } : {}),
  };
}

function plainValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toNumber();
  if (Array.isArray(value)) return value.map(plainValue);
  return value;
}

function toJson<T extends object>(row: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = plainValue(value);
  }
  return out;
}

function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === value ? date : null;
}

function parseValue(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function serializeProject(project: ProjectWithRelations): Record<string, unknown> {
  const { client, tasks, invoices, ...row } = project;
  return {
    ...toJson(row),
    status: WIRE_STATUS[project.status],
    startDate: dateOnly(project.startDate),
    deadline: dateOnly(project.deadline),
    client: toJson(client),
    tasks: tasks.map((task) => toJson(task)),
    invoices: invoices.map((invoice) => toJson(invoice)),
  };
}

export async function GET(request: Request, { params }: RouteContext) {
  const scope = await authorize(request);
  if (scope instanceof Response) return scope;

  const { projectId } = await params;
  if (!UUID_RE.test(projectId)) return notFound();
  const where = scopedWhere(scope, projectId);
  if (!where) return notFound();

  try {
    const project = await prisma.project.findFirst({ where, include: PROJECT_INCLUDE });
    if (!project) return notFound();
    return NextResponse.json({ project: serializeProject(project) });
  } catch {
    return fail('Internal error', 500);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const scope = await authorize(request);
  if (scope instanceof Response) return scope;

  const { projectId } = await params;
  if (!UUID_RE.test(projectId)) return notFound();
  const where = scopedWhere(scope, projectId);
  if (!where) return notFound();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('Invalid JSON body', 400);
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return fail('Invalid request body', 400);
  }
  const input = body as Record<string, unknown>;

  try {
    const existing = await prisma.project.findFirst({ where });
    if (!existing) return notFound();

    const data: Prisma.ProjectUncheckedUpdateInput = {};

    if ('name' in input) {
      if (typeof input.name !== 'string' || input.name.trim() === '' || input.name.trim().length > 120) {
        return fail('Enter a project name of up to 120 characters.', 400);
      }
      data.name = input.name.trim();
    }

    if ('value' in input) {
      const value = parseValue(input.value);
      if (value === null) return fail('Please enter a project value of 0 or more.', 400);
      data.value = value;
    }

    let nextDeadline: Date = existing.deadline;
    if ('deadline' in input) {
      const deadline = parseDay(input.deadline);
      if (!deadline) return fail('Please choose a deadline today or later.', 400);
      nextDeadline = deadline;
      data.deadline = deadline;
    }

    let nextStart: Date | null = existing.startDate;
    if ('startDate' in input) {
      if (input.startDate === null) {
        nextStart = null;
      } else {
        const start = parseDay(input.startDate);
        if (!start) return fail('Enter a valid start date.', 400);
        nextStart = start;
      }
      data.startDate = nextStart;
    }

    if (nextStart && nextDeadline < nextStart) {
      return fail('Enter a deadline on or after the project start date.', 400);
    }

    if ('clientId' in input) {
      if (typeof input.clientId !== 'string' || !UUID_RE.test(input.clientId)) {
        return fail('Please select a client for this project.', 400);
      }
      if (input.clientId !== existing.clientId) {
        const client = await prisma.client.findFirst({
          where: { id: input.clientId, businessId: existing.businessId },
          select: { id: true },
        });
        if (!client) return fail('Please select a client for this project.', 400);

        const mismatched = await prisma.invoice.count({
          where: { projectId: existing.id, clientId: { not: input.clientId } },
        });
        if (mismatched > 0) {
          return fail('Linked invoices belong to a different client. Unlink them before changing the client.', 409);
        }
      }
      data.clientId = input.clientId;
    }

    if ('status' in input) {
      const status = parseStatus(input.status);
      if (!status) {
        return fail(
          'Choose a valid status. Projects move from planning to in progress, then in review, then completed.',
          400,
        );
      }
      if (status !== existing.status) {
        if (existing.status === ProjectStatus.COMPLETED || existing.status === ProjectStatus.CANCELLED) {
          return fail('A completed or cancelled project cannot change status.', 409);
        }
        data.status = status;
        if (status === ProjectStatus.COMPLETED) {
          data.completedAt = new Date();
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return fail('No changes provided', 400);
    }

    const updated = await prisma.project.update({
      where: { id: existing.id },
      data,
      include: PROJECT_INCLUDE,
    });
    return NextResponse.json({ project: serializeProject(updated) });
  } catch (error) {
    if (isRecordNotFound(error)) return notFound();
    return fail('Internal error', 500);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const scope = await authorize(request);
  if (scope instanceof Response) return scope;

  const { projectId } = await params;
  if (!UUID_RE.test(projectId)) return notFound();
  const where = scopedWhere(scope, projectId);
  if (!where) return notFound();

  try {
    const existing = await prisma.project.findFirst({ where, select: { id: true } });
    if (!existing) return notFound();

    const linkedInvoices = await prisma.invoice.count({ where: { projectId: existing.id } });
    if (linkedInvoices > 0) {
      return fail('This project has invoices linked. Set it to cancelled instead.', 409);
    }

    await prisma.project.delete({ where: { id: existing.id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (isRecordNotFound(error)) return notFound();
    return fail('Internal error', 500);
  }
}