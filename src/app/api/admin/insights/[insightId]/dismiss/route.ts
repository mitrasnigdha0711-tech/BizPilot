import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const OWNER_ROLE = 'small_video_editing_business_owner';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: { insightId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (user.role !== OWNER_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const insightId = params.insightId;
  if (!UUID_RE.test(insightId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const owner = await prisma.user.findUnique({
      where: { id: user.id },
      select: { businessId: true },
    });
    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!owner.businessId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const existing = await prisma.insight.findFirst({
      where: { id: insightId, businessId: owner.businessId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const insight = await prisma.insight.update({
      where: { id: insightId },
      data: {
        status: 'DISMISSED',
        dismissedAt: new Date(),
      },
    });

    return NextResponse.json({ insight });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}