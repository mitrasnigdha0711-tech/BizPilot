
import { NextResponse } from 'next/server';
import { Prisma, TaskStatus, TaskType, Priority } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const OWNER_ROLE = 'small_video_editing_business_owner';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TITLE_MAX = 200;

function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
  return d;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

async function resolveOwner(request: Request): Promise<{ businessId: string } | Response> {
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

async function loadBusinessTask(taskId: string, businessId: string) {
  if (!isUuid(taskId)) return null;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { user: { select: { businessId: true } } },
  });
  if (!task || task.user.businessId !== businessId) return null;
  return task;
}

function writeErrorResponse(e: unknown): NextResponse {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}

export async function PATCH(
  request: Request,
  { params }: { params: { taskId: string } },
) {
  const owner = await resolveOwner(request);
  if (owner instanceof Response) return owner;

  const existing = await loadBusinessTask(params.taskId, owner.businessId);
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const input = body as Record<string, unknown>;

  const data: Prisma.TaskUncheckedUpdateInput = {};

  if ('title' in input) {
    if (typeof input.title !== 'string' || input.title.trim() === '') {
      return NextResponse.json({ error: 'Please enter a task title.' }, { status: 400 });
    }
    const title = input.title.trim();
    if (title.length > TITLE_MAX) {
      return NextResponse.json(
        { error: 'Task title must be 200 characters or fewer.' },
        { status: 400 },
      );
    }
    data.title = title;
  }

  if ('dueDate' in input) {
    const due = parseDay(input.dueDate);
    if (!due) {
      return NextResponse.json(
        { error: 'Please choose a valid due date for this task.' },
        { status: 400 },
      );
    }
    data.dueDate = due;
  }

  if ('type' in input) {
    if (input.type === 'task') data.type = TaskType.TASK;
    else if (input.type === 'follow_up') data.type = TaskType.FOLLOW_UP;
    else return NextResponse.json({ error: 'Invalid task type.' }, { status: 400 });
  }

  if ('status' in input) {
    if (input.status === 'open') {
      data.status = TaskStatus.OPEN;
      data.completedAt = null;
    } else if (input.status === 'completed') {
      data.status = TaskStatus.COMPLETED;
      data.completedAt = new Date();
    } else {
      return NextResponse.json(
        { error: 'This task has an invalid status. Please refresh and try again.' },
        { status: 400 },
      );
    }
  }

  if ('priority' in input) {
    if (input.priority === 'low') data.priority = Priority.LOW;
    else if (input.priority === 'medium') data.priority = Priority.MEDIUM;
    else if (input.priority === 'high') data.priority = Priority.HIGH;
    else return NextResponse.json({ error: 'Invalid priority.' }, { status: 400 });
  }

  if ('priorityNote' in input) {
    if (input.priorityNote !== null && typeof input.priorityNote !== 'string') {
      return NextResponse.json({ error: 'Invalid priority note.' }, { status: 400 });
    }
    data.priorityNote = input.priorityNote as string | null;
  }

  if ('clientId' in input) {
    if (input.clientId !== null && !isUuid(input.clientId)) {
      return NextResponse.json({ error: 'Please select a valid client.' }, { status: 400 });
    }
    if (isUuid(input.clientId)) {
      const client = await prisma.client.findFirst({
        where: { id: input.clientId, businessId: owner.businessId },
        select: { id: true },
      });
      if (!client) {
        return NextResponse.json({ error: 'Please select a valid client.' }, { status: 400 });
      }
    }
    data.clientId = input.clientId as string | null;
  }

  // A follow-up must stay linked to a client.
  const resultingType = data.type ?? existing.type;
  const resultingClientId =
    'clientId' in data ? (data.clientId as string | null) : existing.clientId;
  if (resultingType === TaskType.FOLLOW_UP && !resultingClientId) {
    return NextResponse.json(
      { error: 'Please select a client for this follow-up.' },
      { status: 400 },
    );
  }

  if ('projectId' in input) {
    if (input.projectId !== null && !isUuid(input.projectId)) {
      return NextResponse.json({ error: 'Invalid project.' }, { status: 400 });
    }
    if (isUuid(input.projectId)) {
      const project = await prisma.project.findFirst({
        where: { id: input.projectId, businessId: owner.businessId },
        select: { id: true },
      });
      if (!project) {
        return NextResponse.json({ error: 'Invalid project.' }, { status: 400 });
      }
    }
    data.projectId = input.projectId as string | null;
  }

  if ('goalId' in input) {
    if (input.goalId !== null && !isUuid(input.goalId)) {
      return NextResponse.json({ error: 'Invalid goal.' }, { status: 400 });
    }
    data.goalId = input.goalId as string | null;
  }

  if ('quoteId' in input) {
    if (input.quoteId !== null && !isUuid(input.quoteId)) {
      return NextResponse.json({ error: 'Invalid quote.' }, { status: 400 });
    }
    data.quoteId = input.quoteId as string | null;
  }

  if ('assigneeId' in input) {
    if (input.assigneeId !== null && !isUuid(input.assigneeId)) {
      return NextResponse.json({ error: 'Invalid assignee.' }, { status: 400 });
    }
    if (isUuid(input.assigneeId)) {
      const assignee = await prisma.user.findFirst({
        where: { id: input.assigneeId, businessId: owner.businessId },
        select: { id: true },
      });
      if (!assignee) {
        return NextResponse.json({ error: 'Invalid assignee.' }, { status: 400 });
      }
    }
    data.assigneeId = input.assigneeId as string | null;
  }

  if ('plannedWeekStart' in input) {
    if (input.plannedWeekStart === null) {
      data.plannedWeekStart = null;
    } else {
      const planned = parseDay(input.plannedWeekStart);
      if (!planned) {
        return NextResponse.json({ error: 'Invalid planned week.' }, { status: 400 });
      }
      data.plannedWeekStart = planned;
    }
  }

  try {
    const task = await prisma.task.update({
      where: { id: existing.id },
      data,
    });
    return NextResponse.json({ task });
  } catch (e) {
    return writeErrorResponse(e);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { taskId: string } },
) {
  const owner = await resolveOwner(request);
  if (owner instanceof Response) return owner;

  const existing = await loadBusinessTask(params.taskId, owner.businessId);
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    await prisma.task.delete({ where: { id: existing.id } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return writeErrorResponse(e);
  }
}