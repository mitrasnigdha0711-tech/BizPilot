import { NextResponse } from 'next/server';
import { Prisma, ProjectStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const OWNER_ROLE = 'small_video_editing_business_owner';

function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
  return d;
}

function dayString(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function serialize<T extends { deadline: Date; startDate: Date | null }>(p: T) {
  return { ...p, deadline: dayString(p.deadline), startDate: dayString(p.startDate) };
}

async function requireOwner(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, businessId: true },
  });
  if (!me) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (String(me.role).toLowerCase() !== OWNER_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!me.businessId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return { businessId: me.businessId };
}

export async function GET(
  request: Request,
  { params }: { params: { projectId: string } },
) {
  const auth = await requireOwner(request);
  if (auth instanceof Response) return auth;

  const projectId = params.projectId;
  if (!UUID_RE.test(projectId)) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, businessId: auth.businessId },
      include: { client: true, invoices: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({ project: serialize(project) });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { projectId: string } },
) {
  const auth = await requireOwner(request);
  if (auth instanceof Response) return auth;

  const projectId = params.projectId;
  if (!UUID_RE.test(projectId)) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const input = body as Record<string, unknown>;

  if ('status' in input) {
    return NextResponse.json(
      { error: 'Use the complete or cancel actions to change project status.' },
      { status: 400 },
    );
  }

  try {
    const existing = await prisma.project.findFirst({
      where: { id: projectId, businessId: auth.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const data: Prisma.ProjectUncheckedUpdateInput = {};

    if ('name' in input) {
      const name = typeof input.name === 'string' ? input.name.trim() : '';
      if (name.length < 1 || name.length > 120) {
        return NextResponse.json(
          { error: 'Enter a project name of up to 120 characters.' },
          { status: 400 },
        );
      }
      data.name = name;
    }

    if ('clientId' in input) {
      const clientId = input.clientId;
      if (typeof clientId !== 'string' || !UUID_RE.test(clientId)) {
        return NextResponse.json(
          { error: 'Please select a client for this project.' },
          { status: 400 },
        );
      }
      const client = await prisma.client.findFirst({
        where: { id: clientId, businessId: auth.businessId },
        select: { id: true },
      });
      if (!client) {
        return NextResponse.json(
          { error: 'Please select a client for this project.' },
          { status: 400 },
        );
      }
      data.clientId = client.id;
    }

    if ('value' in input) {
      const raw = input.value;
      const num =
        typeof raw === 'number'
          ? raw
          : typeof raw === 'string' && raw.trim() !== ''
            ? Number(raw)
            : NaN;
      if (!Number.isFinite(num) || num < 0) {
        return NextResponse.json(
          { error: 'Please enter a project value of 0 or more.' },
          { status: 400 },
        );
      }
      data.value = num;
    }

    const hasDeadline = 'deadline' in input;
    const hasStart = 'startDate' in input;
    let deadline: Date | undefined;
    let startDate: Date | null | undefined;

    if (hasDeadline) {
      const parsed = parseDay(input.deadline);
      if (!parsed) {
        return NextResponse.json(
          { error: 'Please choose a deadline today or later.' },
          { status: 400 },
        );
      }
      deadline = parsed;
    }

    if (hasStart) {
      if (input.startDate === null || input.startDate === '') {
        startDate = null;
      } else {
        const parsed = parseDay(input.startDate);
        if (!parsed) {
          return NextResponse.json(
            { error: 'Enter a valid start date.' },
            { status: 400 },
          );
        }
        startDate = parsed;
      }
    }

    if (hasDeadline || hasStart) {
      if (existing.status === ProjectStatus.COMPLETED) {
        return NextResponse.json(
          { error: "A completed project's dates can no longer be changed." },
          { status: 409 },
        );
      }
      const effDeadline = deadline ?? existing.deadline;
      const effStart = startDate !== undefined ? startDate : existing.startDate;
      if (effStart && effDeadline.getTime() < effStart.getTime()) {
        return NextResponse.json(
          { error: 'Enter a deadline on or after the project start date.' },
          { status: 400 },
        );
      }
      if (deadline !== undefined) data.deadline = deadline;
      if (startDate !== undefined) data.startDate = startDate;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data,
      include: { client: true, invoices: true },
    });
    return NextResponse.json({ project: serialize(project) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { projectId: string } },
) {
  const auth = await requireOwner(request);
  if (auth instanceof Response) return auth;

  const projectId = params.projectId;
  if (!UUID_RE.test(projectId)) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, businessId: auth.businessId },
      select: { id: true, status: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.status !== ProjectStatus.PLANNED && project.status !== ProjectStatus.CANCELLED) {
      return NextResponse.json(
        { error: 'Only planned or cancelled projects can be deleted. Cancel the project instead.' },
        { status: 409 },
      );
    }

    const invoiceCount = await prisma.invoice.count({ where: { projectId } });
    if (invoiceCount > 0) {
      return NextResponse.json(
        { error: 'This project has invoices linked. Cancel it instead.' },
        { status: 409 },
      );
    }

    await prisma.$transaction([
      prisma.task.deleteMany({ where: { projectId } }),
      prisma.expens.updateMany({ where: { projectId }, data: { projectId: null } }),
      prisma.insight.updateMany({ where: { projectId }, data: { projectId: null } }),
      prisma.project.delete({ where: { id: projectId } }),
    ]);

    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}