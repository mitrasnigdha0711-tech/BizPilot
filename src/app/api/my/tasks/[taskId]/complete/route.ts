import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: { taskId: string } }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const role = String((user as { role?: unknown }).role ?? '').toLowerCase();
  if (role !== 'FREELANCE_VIDEO_EDITOR' && role !== 'FREELANCE_VIDEO_EDITOR' && role !== 'FREELANCE_VIDEO_EDITOR'.toUpperCase().toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const taskId = params.taskId;
  if (!UUID_RE.test(taskId)) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  try {
    const existing = await prisma.task.findFirst({
      where: { id: taskId, userId: user.id },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (existing.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'This task is already completed.' },
        { status: 409 }
      );
    }

    if (existing.status !== 'OPEN') {
      return NextResponse.json(
        { error: 'This task has an invalid status. Please refresh and try again.' },
        { status: 400 }
      );
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ task });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('POST /api/my/tasks/[taskId]/complete failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}