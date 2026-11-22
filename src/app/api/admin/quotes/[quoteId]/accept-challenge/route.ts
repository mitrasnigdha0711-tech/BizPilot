import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OWNER_ROLE = 'small_video_editing_business_owner';

export async function POST(
  request: Request,
  { params }: { params: { quoteId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (String(user.role).toLowerCase() !== OWNER_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const quoteId = params.quoteId;
  if (!UUID_RE.test(quoteId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, userId: user.id },
    });

    if (!quote) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!quote.challengeText) {
      return NextResponse.json(
        { error: 'This quote has no challenge to accept' },
        { status: 409 },
      );
    }

    if (quote.challengeStatus === 'accepted') {
      return NextResponse.json({ quote });
    }

    const updated = await prisma.quote.update({
      where: { id: quote.id },
      data: { challengeStatus: 'accepted' },
    });

    return NextResponse.json({ quote: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}