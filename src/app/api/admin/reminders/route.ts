import { NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, businessId: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (dbUser.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!dbUser.businessId) {
      return NextResponse.json({ reminders: [] });
    }

    const reminders = await prisma.reminder.findMany({
      where: {
        invoice: { businessId: dbUser.businessId },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ reminders });
  } catch (e) {
    console.error('GET /api/admin/reminders failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}