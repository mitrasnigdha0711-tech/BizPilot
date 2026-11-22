import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

const ALLOWED_ROLES = ['freelance_video_editor', 'small_video_editing_business_owner'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: { quoteId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const quoteId = params.quoteId;
  if (!UUID_RE.test(quoteId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, userId: user.id },
      select: { id: true },
    });

    if (!quote) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Skipping records nothing on the quote or task; the client hides the challenge afterwards.
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}