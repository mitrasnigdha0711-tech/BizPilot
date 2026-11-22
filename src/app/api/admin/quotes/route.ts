import { NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });

    if (!me || me.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
      return NextResponse.json(
        { error: 'Not available for your role' },
        { status: 403 },
      );
    }

    const quotes = await prisma.quote.findMany({
      where: { userId: user.id, isFavourite: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ quotes });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}