import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

function localDayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (dbUser.role !== 'FREELANCE_VIDEO_EDITOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const dateParam = new URL(request.url).searchParams.get('date');
  const day =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : localDayString();
  const today = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(today.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  const projectId = params.projectId;

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
    });
    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (project.status !== 'PLANNED') {
      return NextResponse.json(
        { error: 'Only a planned project can be started' },
        { status: 409 }
      );
    }

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        status: 'IN_PROGRESS',
        startDate: project.startDate ?? today,
      },
    });

    return NextResponse.json({ project: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}