
import { NextResponse } from 'next/server';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: { userId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const owner = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, role: true, businessId: true },
  });
  if (!owner) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (owner.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER || !owner.businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId } = params;
  if (!UUID_RE.test(userId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const target = await prisma.user.findFirst({
      where: { id: userId, businessId: owner.businessId },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        isActive: true,
        failedLoginCount: 0,
        lockedUntil: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}