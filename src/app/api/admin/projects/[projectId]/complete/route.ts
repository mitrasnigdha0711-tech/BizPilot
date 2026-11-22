import { NextResponse } from 'next/server';
import { Prisma, ProjectStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, businessId: true, isActive: true },
    });

    if (!me || !me.isActive) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (me.role !== 'SMALL_VIDEO_EDITING_BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!me.businessId) {
      return NextResponse.json({ error: 'No business linked to this account' }, { status: 403 });
    }

    const projectId = params.projectId;
    if (!UUID_RE.test(projectId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, businessId: me.businessId },
    });

    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (project.status === ProjectStatus.COMPLETED) {
      return NextResponse.json({ error: 'Project is already completed' }, { status: 409 });
    }

    if (project.status === ProjectStatus.CANCELLED) {
      return NextResponse.json({ error: 'A cancelled project cannot be completed' }, { status: 409 });
    }

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: {
        status: ProjectStatus.COMPLETED,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ project: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('POST /api/admin/projects/[projectId]/complete failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}