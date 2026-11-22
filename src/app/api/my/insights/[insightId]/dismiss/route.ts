import { NextRequest, NextResponse } from 'next/server';
import { InsightStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type InsightRouteContext = {
  params: { insightId: string } | Promise<{ insightId: string }>;
};

export async function POST(request: NextRequest, context: InsightRouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (user.role !== 'FREELANCE_VIDEO_EDITOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { insightId } = await context.params;

  if (!UUID_RE.test(insightId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const owned = await prisma.insight.findFirst({
      where: { id: insightId, userId: user.id },
      select: { id: true },
    });

    if (!owned) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const insight = await prisma.insight.update({
      where: { id: insightId },
      data: {
        status: InsightStatus.DISMISSED,
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