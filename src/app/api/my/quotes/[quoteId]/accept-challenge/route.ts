import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(
  request: Request,
  { params }: { params: { quoteId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const quoteId = params.quoteId;
  if (!UUID_RE.test(quoteId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const dayParam = new URL(request.url).searchParams.get('date');
  const day =
    dayParam && DAY_RE.test(dayParam)
      ? dayParam
      : new Date().toLocaleDateString('en-CA');
  const dueDate = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(dueDate.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  try {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, userId: user.id },
    });
    if (!quote) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const challenge = (quote.challengeText ?? quote.personalSuggestion ?? '').trim();
    if (!challenge) {
      return NextResponse.json(
        { error: 'This quote has no challenge to accept' },
        { status: 400 },
      );
    }

    if (quote.challengeStatus === 'accepted') {
      return NextResponse.json(
        { error: 'Challenge already accepted' },
        { status: 409 },
      );
    }

    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          title: challenge.slice(0, 200),
          type: 'TASK',
          status: 'OPEN',
          dueDate,
          quoteId: quote.id,
          userId: user.id,
        },
      });
      await tx.quote.update({
        where: { id: quote.id },
        data: { challengeStatus: 'accepted' },
      });
      return created;
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}