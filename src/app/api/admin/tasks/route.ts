import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

const OWNER_ROLE = 'SMALL_VIDEO_EDITING_BUSINESS_OWNER';

function toDay(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, businessId: true },
    });

    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (me.role !== OWNER_ROLE) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!me.businessId) {
      return NextResponse.json({ tasks: [] });
    }

    const rows = await prisma.task.findMany({
      where: { user: { businessId: me.businessId } },
      include: {
        assignee: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    const tasks = rows.map((t) => ({
      id: t.id,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      title: t.title,
      type: t.type,
      status: t.status,
      priority: t.priority,
      priorityNote: t.priorityNote,
      dueDate: toDay(t.dueDate),
      plannedWeekStart: toDay(t.plannedWeekStart),
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
      projectId: t.projectId,
      clientId: t.clientId,
      goalId: t.goalId,
      quoteId: t.quoteId,
      assigneeId: t.assigneeId,
      assigneeName: t.assignee ? t.assignee.name : null,
      userId: t.userId,
    }));

    return NextResponse.json({ tasks });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}