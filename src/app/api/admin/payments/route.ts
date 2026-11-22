import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const OWNER_ROLE = 'small_video_editing_business_owner';
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(value: string | null): Date | null | 'invalid' {
  if (!value) return null;
  if (!DAY_PATTERN.test(value)) return 'invalid';
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return 'invalid';
  return date;
}

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (String(user.role).toLowerCase() !== OWNER_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const clientId = params.get('clientId') ?? params.get('client_id');
  const dateField = params.get('dateField') ?? params.get('date_field') ?? 'expected';

  if (dateField !== 'expected' && dateField !== 'received') {
    return NextResponse.json(
      { error: 'dateField must be "expected" or "received"' },
      { status: 400 },
    );
  }

  const from = parseDay(params.get('from'));
  const to = parseDay(params.get('to'));
  if (from === 'invalid' || to === 'invalid') {
    return NextResponse.json(
      { error: 'from and to must be dates in YYYY-MM-DD format' },
      { status: 400 },
    );
  }
  if (from && to && from.getTime() > to.getTime()) {
    return NextResponse.json({ error: 'from must be on or before to' }, { status: 400 });
  }

  try {
    const owner = await prisma.user.findUnique({
      where: { id: user.id },
      select: { businessId: true },
    });

    if (!owner) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!owner.businessId) {
      return NextResponse.json({ payments: [] });
    }

    // Inclusive end day: compare against the start of the following day.
    const toExclusive = to ? new Date(to.getTime() + 24 * 60 * 60 * 1000) : null;

    const dateFilter =
      dateField === 'expected'
        ? {
            ...(from || toExclusive
              ? {
                  expectedDate: {
                    ...(from ? { gte: from } : {}),
                    ...(toExclusive ? { lt: toExclusive } : {}),
                  },
                }
              : {}),
          }
        : {
            ...(from || toExclusive
              ? {
                  receivedAt: {
                    ...(from ? { gte: from } : {}),
                    ...(toExclusive ? { lt: toExclusive } : {}),
                  },
                }
              : {}),
          };

    const payments = await prisma.payment.findMany({
      where: {
        invoice: { businessId: owner.businessId },
        ...(clientId ? { clientId } : {}),
        ...dateFilter,
      },
      include: {
        invoice: { select: { id: true, invoiceNumber: true, dueDate: true, status: true } },
        client: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ payments });
  } catch (e) {
    console.error('GET /api/admin/payments failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}