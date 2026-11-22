import { NextResponse } from 'next/server';
import { Prisma, InsightStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: { insightId: string } }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
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

    const insightId = params.insightId;
    if (!UUID_RE.test(insightId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const existing = await prisma.insight.findFirst({
      where: { id: insightId, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const insight = await prisma.insight.update({
      where: { id: existing.id },
      data: { status: InsightStatus.DONE },
    });

    return NextResponse.json({ insight });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}