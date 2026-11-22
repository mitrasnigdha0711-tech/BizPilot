import { NextResponse } from 'next/server';
import { TaskStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const FREELANCE_ROLE = 'freelance_video_editor';

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (user.role !== FREELANCE_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get('status');

  let status: TaskStatus | undefined;
  if (statusParam !== null) {
    if (statusParam === 'open') {
      status = TaskStatus.OPEN;
    } else if (statusParam === 'completed') {
      status = TaskStatus.COMPLETED;
    } else {
      return NextResponse.json(
        { error: 'This task has an invalid status. Please refresh and try again.' },
        { status: 400 },
      );
    }
  }

  try {
    const tasks = await prisma.task.findMany({
      where: {
        userId: user.id,
        ...(status ? { status } : {}),
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ tasks });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}