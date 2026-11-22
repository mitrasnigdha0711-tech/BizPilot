import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: Request,
  { params }: { params: { quoteId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (user.role !== 'SMALL_VIDEO_EDITING_BUSINESS_OWNER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const isFavourite =
    typeof body === 'object' && body !== null && 'isFavourite' in body
      ? (body as { isFavourite: unknown }).isFavourite
      : undefined;

  if (typeof isFavourite !== 'boolean') {
    return NextResponse.json(
      { error: 'isFavourite must be a boolean' },
      { status: 400 },
    );
  }

  const quoteId = params.quoteId;
  if (!UUID_RE.test(quoteId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const existing = await prisma.quote.findFirst({
      where: { id: quoteId, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const quote = await prisma.quote.update({
      where: { id: quoteId },
      data: { isFavourite },
    });

    return NextResponse.json({ quote });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}