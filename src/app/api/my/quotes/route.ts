import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

const ALLOWED_ROLES: string[] = [
  'FREELANCE_VIDEO_EDITOR',
  'SMALL_VIDEO_EDITING_BUSINESS_OWNER',
];

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const caller = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, isActive: true },
    });

    if (!caller || !caller.isActive) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(caller.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const displayDateParam = searchParams.get('display_date');
    const isFavouriteParam = searchParams.get('is_favourite');

    let displayDate: Date | undefined;
    if (displayDateParam !== null) {
      if (!DAY_PATTERN.test(displayDateParam)) {
        return NextResponse.json(
          { error: 'display_date must be YYYY-MM-DD' },
          { status: 400 },
        );
      }
      const parsed = new Date(`${displayDateParam}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: 'display_date is not a valid date' },
          { status: 400 },
        );
      }
      displayDate = parsed;
    }

    const quotes = await prisma.quote.findMany({
      where: {
        userId: user.id,
        ...(displayDate ? { displayDate } : {}),
        ...(isFavouriteParam === 'true' ? { isFavourite: true } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    const payload = quotes.map((quote) => ({
      ...quote,
      displayDate: quote.displayDate.toISOString().slice(0, 10),
    }));

    return NextResponse.json({ quotes: payload });
  } catch (e) {
    console.error('GET /api/my/quotes failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}