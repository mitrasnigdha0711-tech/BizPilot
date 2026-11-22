import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const ALLOWED_ROLES = ['freelance_video_editor', 'small_video_editing_business_owner'];
const OWNER_ROLE = 'small_video_editing_business_owner';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITIES = ['low', 'medium', 'high'] as const;
const TASK_TYPES = ['task', 'follow_up'] as const;

type Ctx = { params: { taskId: string } };
type TaskRecord = NonNullable<Awaited<ReturnType<typeof prisma.task.findFirst>>>;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDay(value: string): Date | null {
  if (!DATE_RE.test(value)) return null;
  const d = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || ymd(d) !== value) return null;
  return d;
}

function toJson(t: TaskRecord) {
  return {
    id: t.id,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    title: t.title,
    type: t.type,
    status: t.status,
    priority: t.priority,
    priorityNote: t.priorityNote,
    dueDate: t.dueDate ? ymd(t.dueDate) : null,
    plannedWeekStart: t.plannedWeekStart ? ymd(t.plannedWeekStart) : null,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    projectId: t.projectId,
    clientId: t.clientId,
    goalId: t.goalId,
    quoteId: t.quoteId,
    assigneeId: t.assigneeId,
    userId: t.userId,
  };
}

async function resolveTask(
  userId: string,
  taskId: string,
): Promise<
  | { ok: true; task: TaskRecord; me: { id: string; role: string; businessId: string | null } }
  | { ok: false; response: NextResponse }
> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, businessId: true },
  });
  if (!me) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!ALLOWED_ROLES.includes(me.role)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  if (!UUID_RE.test(taskId)) {
    return { ok: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  let task: TaskRecord | null;
  if (me.role === OWNER_ROLE) {
    if (!me.businessId) {
      return { ok: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
    }
    task = await prisma.task.findFirst({
      where: { id: taskId, user: { businessId: me.businessId } },
    });
  } else {
    task = await prisma.task.findFirst({
      where: { id: taskId, userId: me.id },
    });
  }

  if (!task) {
    return { ok: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }
  return { ok: true, task, me };
}

export async function GET(request: Request, { params }: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const access = await resolveTask(user.id, params.taskId);
    if (!access.ok) return access.response;
    return NextResponse.json({ task: toJson(access.task) });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;

  try {
    const access = await resolveTask(user.id, params.taskId);
    if (!access.ok) return access.response;
    const { task, me } = access;
    const isOwner = me.role === OWNER_ROLE;

    const data: Prisma.TaskUpdateInput = {};

    if ('title' in body) {
      if (typeof body.title !== 'string' || body.title.trim() === '') {
        return NextResponse.json({ error: 'Please enter a task title.' }, { status: 400 });
      }
      const title = body.title.trim();
      if (title.length > 200) {
        return NextResponse.json(
          { error: 'Task title must be 200 characters or fewer.' },
          { status: 400 },
        );
      }
      data.title = title;
    }

    if ('type' in body) {
      if (typeof body.type !== 'string' || !(TASK_TYPES as readonly string[]).includes(body.type)) {
        return NextResponse.json({ error: 'Please choose a valid task type.' }, { status: 400 });
      }
      data.type = body.type === 'follow_up' ? 'FOLLOW_UP' : 'TASK';
    }

    if ('priority' in body) {
      if (typeof body.priority !== 'string' || !(PRIORITIES as readonly string[]).includes(body.priority)) {
        return NextResponse.json({ error: 'Please choose a valid priority.' }, { status: 400 });
      }
      data.priority = body.priority.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH';
    }

    if ('priorityNote' in body) {
      if (body.priorityNote !== null && typeof body.priorityNote !== 'string') {
        return NextResponse.json({ error: 'Priority note must be text.' }, { status: 400 });
      }
      const note = typeof body.priorityNote === 'string' ? body.priorityNote.trim() : '';
      data.priorityNote = note === '' ? null : note;
    }

    if ('dueDate' in body) {
      const parsed = typeof body.dueDate === 'string' ? parseDay(body.dueDate) : null;
      if (!parsed) {
        return NextResponse.json(
          { error: 'Please choose a valid due date for this task.' },
          { status: 400 },
        );
      }
      data.dueDate = parsed;
    }

    if ('assigneeId' in body) {
      if (!isOwner) {
        return NextResponse.json(
          { error: 'Only the business owner can reassign tasks.' },
          { status: 403 },
        );
      }
      if (body.assigneeId === null) {
        data.assignee = { disconnect: true };
      } else if (typeof body.assigneeId === 'string' && UUID_RE.test(body.assigneeId)) {
        if (!me.businessId) {
          return NextResponse.json({ error: 'Assignee not found' }, { status: 400 });
        }
        const assignee = await prisma.user.findFirst({
          where: { id: body.assigneeId, businessId: me.businessId },
          select: { id: true },
        });
        if (!assignee) {
          return NextResponse.json({ error: 'Assignee not found' }, { status: 400 });
        }
        data.assignee = { connect: { id: assignee.id } };
      } else {
        return NextResponse.json({ error: 'Invalid assignee' }, { status: 400 });
      }
    }

    const nextType = data.type ?? task.type;
    if (nextType === 'FOLLOW_UP' && !task.clientId) {
      return NextResponse.json(
        { error: 'Please select a client for this follow-up.' },
        { status: 400 },
      );
    }

    const updated = await prisma.task.update({
      where: { id: task.id },
      data,
    });
    return NextResponse.json({ task: toJson(updated) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const access = await resolveTask(user.id, params.taskId);
    if (!access.ok) return access.response;

    await prisma.task.delete({ where: { id: access.task.id } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}