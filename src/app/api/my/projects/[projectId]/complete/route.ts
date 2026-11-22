import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (user.role !== 'FREELANCE_VIDEO_EDITOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const projectId = params.projectId;
  if (!UUID_RE.test(projectId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const existing = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (existing.status !== 'PLANNED' && existing.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Only planned or in-progress projects can be completed' },
        { status: 409 }
      );
    }

    const project = await prisma.project.update({
      where: { id: existing.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ project });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}