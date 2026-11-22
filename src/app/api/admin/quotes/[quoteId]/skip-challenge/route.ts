import { NextResponse } from 'next/server';
import { Prisma, Role } from '@prisma/client';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: { quoteId: string } }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, businessId: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (dbUser.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!dbUser.businessId) {
      return NextResponse.json({ error: 'No business linked to this account' }, { status: 403 });
    }

    const quoteId = params.quoteId;
    if (!UUID_RE.test(quoteId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const result = await prisma.quote.updateMany({
      where: { id: quoteId, businessId: dbUser.businessId },
      data: { challengeStatus: 'skipped' },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}