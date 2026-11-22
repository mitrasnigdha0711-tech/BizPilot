import { NextResponse } from 'next/server';
import { Prisma, ProjectStatus, Role } from '@prisma/client';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

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
      select: { role: true, businessId: true },
    });

    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (me.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const projectId = params.projectId;
    if (!me.businessId || !UUID_RE.test(projectId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const existing = await prisma.project.findFirst({
      where: { id: projectId, businessId: me.businessId },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (existing.status === ProjectStatus.COMPLETED) {
      return NextResponse.json(
        { error: 'A completed project cannot be cancelled' },
        { status: 409 }
      );
    }

    try {
      const project = await prisma.project.update({
        where: { id: existing.id },
        data: { status: ProjectStatus.CANCELLED },
      });

      return NextResponse.json({ project });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      throw e;
    }
  } catch (e) {
    console.error('Failed to cancel project', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}