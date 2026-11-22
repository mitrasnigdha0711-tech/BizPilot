import { NextResponse } from 'next/server';
import { Prisma, Role, TaskStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: { taskId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, businessId: true },
  });
  if (!me) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (me.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!me.businessId) {
    return NextResponse.json({ error: 'Business not set up' }, { status: 403 });
  }

  const taskId = params.taskId;
  if (!UUID_RE.test(taskId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let task;
  try {
    task = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { userId: user.id },
          { user: { businessId: me.businessId } },
        ],
      },
      select: { id: true, status: true },
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  if (!task) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (task.status === TaskStatus.COMPLETED) {
    return NextResponse.json(
      { error: 'This task is already completed.' },
      { status: 409 },
    );
  }
  if (task.status !== TaskStatus.OPEN) {
    return NextResponse.json(
      { error: 'This task has an invalid status. Please refresh and try again.' },
      { status: 422 },
    );
  }

  try {
    const updated = await prisma.task.update({
      where: { id: task.id },
      data: {
        status: TaskStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
    return NextResponse.json({ task: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}