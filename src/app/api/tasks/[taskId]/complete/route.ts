
import { NextResponse } from 'next/server';
import { Prisma, Role, TaskStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: { taskId: string } }) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, businessId: true, isActive: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  if (!dbUser.isActive) {
    return NextResponse.json({ error: 'Account is inactive' }, { status: 403 });
  }

  const isOwner = dbUser.role === Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER;
  const isEditor = dbUser.role === Role.FREELANCE_VIDEO_EDITOR;
  if (!isOwner && !isEditor) {
    return NextResponse.json({ error: 'Not available for your role' }, { status: 403 });
  }

  const taskId = params.taskId;
  if (!UUID_RE.test(taskId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { user: { select: { businessId: true } } },
    });
    if (!task) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const ownsTask = task.userId === user.id;
    const sameBusiness =
      dbUser.businessId !== null &&
      task.user.businessId !== null &&
      task.user.businessId === dbUser.businessId;
    const allowed = isOwner ? ownsTask || sameBusiness : ownsTask;
    if (!allowed) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (task.status !== TaskStatus.OPEN) {
      return NextResponse.json({ error: 'This task is already completed.' }, { status: 409 });
    }

    const result = await prisma.task.updateMany({
      where: { id: taskId, status: TaskStatus.OPEN },
      data: { status: TaskStatus.COMPLETED, completedAt: new Date() },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: 'This task is already completed.' }, { status: 409 });
    }

    const updated = await prisma.task.findUnique({ where: { id: taskId } });
    return NextResponse.json({ task: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}