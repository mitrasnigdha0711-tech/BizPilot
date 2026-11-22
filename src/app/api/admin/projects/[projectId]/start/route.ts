import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const OWNER_ROLE = 'small_video_editing_business_owner';

export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const { projectId } = params;
  if (!UUID_RE.test(projectId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const url = new URL(request.url);
  const dayParam = url.searchParams.get('date');
  if (dayParam !== null && !DAY_RE.test(dayParam)) {
    return NextResponse.json({ error: 'Invalid date, expected YYYY-MM-DD' }, { status: 400 });
  }
  const day = dayParam ?? new Date().toLocaleDateString('en-CA');
  const today = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(today.getTime())) {
    return NextResponse.json({ error: 'Invalid date, expected YYYY-MM-DD' }, { status: 400 });
  }

  try {
    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, businessId: true },
    });
    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (String(me.role).toLowerCase() !== OWNER_ROLE) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!me.businessId) {
      return NextResponse.json({ error: 'No business linked to this account' }, { status: 403 });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, businessId: me.businessId },
    });
    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (project.status !== 'PLANNED') {
      return NextResponse.json(
        { error: 'Only a planned project can be started' },
        { status: 409 },
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