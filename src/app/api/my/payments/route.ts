import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type DayParse = { ok: true; day: Date | undefined } | { ok: false };

function parseDay(raw: string | null): DayParse {
  if (raw === null || raw === '') return { ok: true, day: undefined };
  if (!DAY_PATTERN.test(raw)) return { ok: false };
  const day = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== raw) {
    return { ok: false };
  }
  return { ok: true, day };
}

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId') || undefined;

  const expectedFrom = parseDay(searchParams.get('expectedFrom'));
  const expectedTo = parseDay(searchParams.get('expectedTo'));
  const receivedFrom = parseDay(searchParams.get('receivedFrom'));
  const receivedTo = parseDay(searchParams.get('receivedTo'));

  if (!expectedFrom.ok || !expectedTo.ok || !receivedFrom.ok || !receivedTo.ok) {
    return NextResponse.json(
      { error: 'Dates must use the YYYY-MM-DD format' },
      { status: 400 },
    );
  }

  const where: Prisma.PaymentWhereInput = { userId: user.id };

  if (clientId) {
    where.clientId = clientId;
  }

  // expectedDate is a calendar day (@db.Date): match it directly.
  if (expectedFrom.day || expectedTo.day) {
    where.expectedDate = {
      ...(expectedFrom.day ? { gte: expectedFrom.day } : {}),
      ...(expectedTo.day ? { lte: expectedTo.day } : {}),
    };
  }

  // receivedAt is a timestamp: a "to" day includes the whole day (exclusive upper bound at next midnight).
  if (receivedFrom.day || receivedTo.day) {
    where.receivedAt = {
      ...(receivedFrom.day ? { gte: receivedFrom.day } : {}),
      ...(receivedTo.day
        ? { lt: new Date(receivedTo.day.getTime() + ONE_DAY_MS) }
        : {}),
    };
  }

  try {
    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        invoice: { select: { id: true, invoiceNumber: true } },
        client: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ payments });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}