import { NextResponse } from 'next/server';
import { Prisma, ProjectStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export async function POST(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });
    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (me.role !== Role.FREELANCE_VIDEO_EDITOR) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const projectId = params.projectId;

    const existing = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
      select: { id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (
      existing.status !== ProjectStatus.PLANNED &&
      existing.status !== ProjectStatus.IN_PROGRESS
    ) {
      return NextResponse.json(
        { error: 'Only planned or in-progress projects can be cancelled' },
        { status: 409 }
      );
    }

    const result = await prisma.project.updateMany({
      where: {
        id: projectId,
        userId: user.id,
        status: { in: [ProjectStatus.PLANNED, ProjectStatus.IN_PROGRESS] },
      },
      data: { status: ProjectStatus.CANCELLED },
    });

    if (result.count === 0) {
      const current = await prisma.project.findFirst({
        where: { id: projectId, userId: user.id },
        select: { id: true },
      });
      if (!current) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: 'Only planned or in-progress projects can be cancelled' },
        { status: 409 }
      );
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
    });
    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}