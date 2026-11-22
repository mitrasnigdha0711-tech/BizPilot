import { NextRequest, NextResponse } from 'next/server';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toWireRole(role: Role): string {
  return role === Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER
    ? 'small_video_editing_business_owner'
    : 'freelance_video_editor';
}

export async function POST(
  request: NextRequest,
  { params }: { params: { userId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const caller = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, businessId: true },
    });
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (caller.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER || !caller.businessId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userId = params.userId;
    if (!UUID_RE.test(userId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (userId === caller.id) {
      return NextResponse.json(
        { error: 'You cannot deactivate your own account' },
        { status: 400 },
      );
    }

    const target = await prisma.user.findFirst({
      where: { id: userId, businessId: caller.businessId },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        sessionToken: null,
        signedOutAt: new Date(),
        tokenVersion: { increment: 1 },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: toWireRole(updated.role),
        isActive: updated.isActive,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}