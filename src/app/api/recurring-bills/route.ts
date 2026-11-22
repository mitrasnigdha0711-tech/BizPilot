import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const ALLOWED_ROLES = ['freelance_video_editor', 'small_video_editing_business_owner'];

const FREQUENCY_MAP: Record<string, 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'> = {
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
  quarterly: 'QUARTERLY',
  yearly: 'YEARLY',
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return null;
  const d = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null;
  return d;
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (!ALLOWED_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const body = (raw ?? {}) as Record<string, unknown>;

  // Name
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'Please enter a name for this bill.' }, { status: 400 });
  }
  if (name.length > 100) {
    return NextResponse.json({ error: 'Bill name must be 100 characters or fewer.' }, { status: 400 });
  }

  // Amount
  const amount =
    typeof body.amount === 'number'
      ? body.amount
      : typeof body.amount === 'string' && body.amount.trim() !== ''
        ? Number(body.amount)
        : NaN;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return NextResponse.json({ error: 'Enter an amount between 0.01 and 1,000,000.' }, { status: 400 });
  }

  // Frequency
  const frequency = typeof body.frequency === 'string' ? FREQUENCY_MAP[body.frequency] : undefined;
  if (!frequency) {
    return NextResponse.json({ error: 'Choose how often this bill repeats.' }, { status: 400 });
  }

  // Start date
  const startDate = parseDay(body.startDate);
  if (!startDate) {
    return NextResponse.json({ error: 'Please choose a start date for this bill.' }, { status: 400 });
  }

  // End date (optional)
  let endDate: Date | null = null;
  if (body.endDate !== undefined && body.endDate !== null && body.endDate !== '') {
    endDate = parseDay(body.endDate);
    if (!endDate || endDate.getTime() <= startDate.getTime()) {
      return NextResponse.json(
        { error: 'End date must be after the start date, or leave it empty for an ongoing bill.' },
        { status: 400 },
      );
    }
  }

  try {
    const owner = await prisma.user.findUnique({
      where: { id: user.id },
      select: { businessId: true },
    });
    if (!owner?.businessId) {
      return NextResponse.json({ error: 'Set up your business before adding bills.' }, { status: 400 });
    }

    const recurringBill = await prisma.recurringBill.create({
      data: {
        name,
        amount,
        frequency,
        startDate,
        endDate,
        nextDueDate: startDate,
        status: 'ACTIVE',
        businessId: owner.businessId,
        userId: user.id,
      },
    });

    return NextResponse.json({ recurringBill }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}