import { NextRequest, NextResponse } from 'next/server';
import { Prisma, Priority, Role, Task, TaskType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITIES: readonly string[] = ['LOW', 'MEDIUM', 'HIGH'];
const TITLE_MAX = 200;

function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === value ? date : null;
}

function toDay(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function serializeTask(task: Task) {
  return {
    ...task,
    dueDate: toDay(task.dueDate),
    plannedWeekStart: toDay(task.plannedWeekStart),
  };
}

async function loadEditor(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, role: true, businessId: true },
  });
  if (!me) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (me.role !== Role.FREELANCE_VIDEO_EDITOR) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return me;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const me = await loadEditor(request);
  if (me instanceof Response) return me;

  const taskId = params.taskId;
  if (!UUID_RE.test(taskId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, userId: me.id },
  });
  if (!task) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

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

  const data: Prisma.TaskUncheckedUpdateInput = {};

  if ('title' in body) {
    if (typeof body.title !== 'string' || body.title.trim() === '') {
      return NextResponse.json({ error: 'Please enter a task title.' }, { status: 400 });
    }
    const title = body.title.trim();
    if (title.length > TITLE_MAX) {
      return NextResponse.json(
        { error: 'Task title must be 200 characters or fewer.' },
        { status: 400 }
      );
    }
    data.title = title;
  }

  if ('dueDate' in body) {
    const due = parseDay(body.dueDate);
    if (!due) {
      return NextResponse.json(
        { error: 'Please choose a valid due date for this task.' },
        { status: 400 }
      );
    }
    data.dueDate = due;
  }

  if ('priority' in body) {
    const normalized =
      typeof body.priority === 'string' ? body.priority.trim().toUpperCase() : '';
    if (!PRIORITIES.includes(normalized)) {
      return NextResponse.json({ error: 'Invalid priority' }, { status: 400 });
    }
    data.priority = normalized as Priority;
  }

  if ('priorityNote' in body) {
    if (body.priorityNote !== null && typeof body.priorityNote !== 'string') {
      return NextResponse.json({ error: 'Invalid priority note' }, { status: 400 });
    }
    const note = typeof body.priorityNote === 'string' ? body.priorityNote.trim() : '';
    data.priorityNote = note === '' ? null : note;
  }

  const businessId = me.businessId;

  if ('projectId' in body) {
    if (body.projectId === null) {
      data.projectId = null;
    } else if (typeof body.projectId === 'string' && UUID_RE.test(body.projectId)) {
      const project = businessId
        ? await prisma.project.findFirst({
            where: { id: body.projectId, businessId },
            select: { id: true },
          })
        : null;
      if (!project) {
        return NextResponse.json(
          { error: 'The selected project does not belong to your business.' },
          { status: 400 }
        );
      }
      data.projectId = body.projectId;
    } else {
      return NextResponse.json({ error: 'Invalid project' }, { status: 400 });
    }
  }

  if ('clientId' in body) {
    if (body.clientId === null) {
      data.clientId = null;
    } else if (typeof body.clientId === 'string' && UUID_RE.test(body.clientId)) {
      const client = businessId
        ? await prisma.client.findFirst({
            where: { id: body.clientId, businessId },
            select: { id: true },
          })
        : null;
      if (!client) {
        return NextResponse.json(
          { error: 'The selected client does not belong to your business.' },
          { status: 400 }
        );
      }
      data.clientId = body.clientId;
    } else {
      return NextResponse.json({ error: 'Invalid client' }, { status: 400 });
    }
  }

  if ('goalId' in body) {
    if (body.goalId === null) {
      data.goalId = null;
    } else if (typeof body.goalId === 'string' && UUID_RE.test(body.goalId)) {
      const goal = businessId
        ? await prisma.goal.findFirst({
            where: { id: body.goalId, businessId },
            select: { id: true },
          })
        : null;
      if (!goal) {
        return NextResponse.json(
          { error: 'The selected goal does not belong to your business.' },
          { status: 400 }
        );
      }
      data.goalId = body.goalId;
    } else {
      return NextResponse.json({ error: 'Invalid goal' }, { status: 400 });
    }
  }

  const resultingClientId =
    data.clientId !== undefined ? data.clientId : task.clientId;
  if (task.type === TaskType.FOLLOW_UP && !resultingClientId) {
    return NextResponse.json(
      { error: 'Please select a client for this follow-up.' },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.task.update({
      where: { id: taskId },
      data,
    });
    return NextResponse.json({ task: serializeTask(updated) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const me = await loadEditor(request);
  if (me instanceof Response) return me;

  const taskId = params.taskId;
  if (!UUID_RE.test(taskId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const existing = await prisma.task.findFirst({
      where: { id: taskId, userId: me.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.task.delete({ where: { id: taskId } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}