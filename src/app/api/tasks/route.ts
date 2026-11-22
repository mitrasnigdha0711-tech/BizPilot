import { NextResponse } from 'next/server';
import { Priority, Role, TaskStatus, TaskType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const TYPE_MAP: Record<string, TaskType> = {
  task: TaskType.TASK,
  follow_up: TaskType.FOLLOW_UP,
};

const PRIORITY_MAP: Record<string, Priority> = {
  low: Priority.LOW,
  medium: Priority.MEDIUM,
  high: Priority.HIGH,
};

function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !DATE_ONLY.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return null;
  }
  return date;
}

function readOptionalId(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return null;
  return value;
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, businessId: true, isActive: true },
    });

    if (!dbUser || !dbUser.isActive) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (
      dbUser.role !== Role.FREELANCE_VIDEO_EDITOR &&
      dbUser.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

    // Title
    const title = typeof input.title === 'string' ? input.title.trim() : '';
    if (!title) {
      return NextResponse.json({ error: 'Please enter a task title.' }, { status: 400 });
    }
    if (title.length > 200) {
      return NextResponse.json(
        { error: 'Task title must be 200 characters or fewer.' },
        { status: 400 },
      );
    }

    // Due date
    const dueDate = parseDay(input.dueDate);
    if (!dueDate) {
      return NextResponse.json(
        { error: 'Please choose a valid due date for this task.' },
        { status: 400 },
      );
    }

    // Type
    const rawType = input.type ?? 'task';
    const type = typeof rawType === 'string' ? TYPE_MAP[rawType] : undefined;
    if (!type) {
      return NextResponse.json({ error: 'Please choose a valid task type.' }, { status: 400 });
    }

    // Status: a new task always starts open
    if (input.status !== undefined && input.status !== null && input.status !== 'open') {
      return NextResponse.json(
        { error: 'This task has an invalid status. Please refresh and try again.' },
        { status: 400 },
      );
    }

    // Priority
    const rawPriority = input.priority ?? 'medium';
    const priority = typeof rawPriority === 'string' ? PRIORITY_MAP[rawPriority] : undefined;
    if (!priority) {
      return NextResponse.json({ error: 'Please choose a valid priority.' }, { status: 400 });
    }

    // Priority note
    let priorityNote: string | null = null;
    if (input.priorityNote !== undefined && input.priorityNote !== null) {
      if (typeof input.priorityNote !== 'string') {
        return NextResponse.json({ error: 'Priority note must be text.' }, { status: 400 });
      }
      const note = input.priorityNote.trim();
      priorityNote = note === '' ? null : note;
    }

    // Linked ids
    const clientId = readOptionalId(input.clientId);
    const projectId = readOptionalId(input.projectId);
    const goalId = readOptionalId(input.goalId);
    const assigneeIdInput = readOptionalId(input.assigneeId);

    if (clientId === null || projectId === null || goalId === null || assigneeIdInput === null) {
      return NextResponse.json({ error: 'Invalid id in request.' }, { status: 400 });
    }

    if (type === TaskType.FOLLOW_UP && !clientId) {
      return NextResponse.json(
        { error: 'Please select a client for this follow-up.' },
        { status: 400 },
      );
    }

    const businessId = dbUser.businessId;
    const hasLinks = Boolean(clientId || projectId || goalId || assigneeIdInput);
    if (hasLinks && !businessId) {
      return NextResponse.json(
        { error: 'Your account is not linked to a business yet.' },
        { status: 400 },
      );
    }

    // Each linked record must belong to the caller's business.
    if (clientId) {
      const client = await prisma.client.findFirst({
        where: { id: clientId, businessId: businessId as string },
        select: { id: true },
      });
      if (!client) {
        return NextResponse.json({ error: 'Selected client was not found.' }, { status: 400 });
      }
    }

    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, businessId: businessId as string },
        select: { id: true },
      });
      if (!project) {
        return NextResponse.json({ error: 'Selected project was not found.' }, { status: 400 });
      }
    }

    if (goalId) {
      const goal = await prisma.goal.findFirst({
        where: { id: goalId, businessId: businessId as string },
        select: { id: true },
      });
      if (!goal) {
        return NextResponse.json({ error: 'Selected goal was not found.' }, { status: 400 });
      }
    }

    // Assignee defaults to the caller and must be a member of the same business.
    let assigneeId: string = user.id;
    if (assigneeIdInput) {
      const assignee = await prisma.user.findFirst({
        where: { id: assigneeIdInput, businessId: businessId as string },
        select: { id: true },
      });
      if (!assignee) {
        return NextResponse.json({ error: 'Selected assignee was not found.' }, { status: 400 });
      }
      assigneeId = assignee.id;
    }

    const task = await prisma.task.create({
      data: {
        title,
        type,
        status: TaskStatus.OPEN,
        priority,
        priorityNote,
        dueDate,
        clientId: clientId ?? null,
        projectId: projectId ?? null,
        goalId: goalId ?? null,
        assigneeId,
        userId: user.id,
      },
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}