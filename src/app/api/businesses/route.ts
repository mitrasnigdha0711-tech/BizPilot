import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const ALLOWED_ROLES = ['freelance_video_editor', 'small_video_editing_business_owner'];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  if (!Array.isArray(b.services)) {
    return NextResponse.json({ error: 'services must be an array of strings' }, { status: 400 });
  }
  const services: string[] = [];
  for (const s of b.services) {
    if (typeof s !== 'string' || !s.trim()) {
      return NextResponse.json({ error: 'services must be an array of non-empty strings' }, { status: 400 });
    }
    services.push(s.trim());
  }

  const monthlyProjectTarget = b.monthlyProjectTarget;
  if (
    typeof monthlyProjectTarget !== 'number' ||
    !Number.isInteger(monthlyProjectTarget) ||
    monthlyProjectTarget <= 0
  ) {
    return NextResponse.json(
      { error: 'monthlyProjectTarget must be a positive whole number' },
      { status: 400 },
    );
  }

  const workingHoursStart = typeof b.workingHoursStart === 'string' ? b.workingHoursStart : '';
  const workingHoursEnd = typeof b.workingHoursEnd === 'string' ? b.workingHoursEnd : '';
  if (!TIME_RE.test(workingHoursStart) || !TIME_RE.test(workingHoursEnd)) {
    return NextResponse.json(
      { error: 'workingHoursStart and workingHoursEnd must be HH:mm' },
      { status: 400 },
    );
  }
  if (toMinutes(workingHoursStart) >= toMinutes(workingHoursEnd)) {
    return NextResponse.json(
      { error: 'workingHoursStart must be earlier than workingHoursEnd' },
      { status: 400 },
    );
  }

  const currency = typeof b.currency === 'string' ? b.currency.trim().toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(currency)) {
    return NextResponse.json({ error: 'currency must be a 3-letter ISO code' }, { status: 400 });
  }

  let businessType: 'FREELANCE' | 'SMALL_BUSINESS' = 'FREELANCE';
  if (b.businessType !== undefined) {
    if (b.businessType === 'freelance') businessType = 'FREELANCE';
    else if (b.businessType === 'small_business') businessType = 'SMALL_BUSINESS';
    else {
      return NextResponse.json(
        { error: "businessType must be 'freelance' or 'small_business'" },
        { status: 400 },
      );
    }
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, businessId: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = String(dbUser.role).toLowerCase();
    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (dbUser.businessId) {
      return NextResponse.json(
        { error: 'A business is already set up for this account' },
        { status: 409 },
      );
    }

    const business = await prisma.$transaction(async (tx) => {
      const created = await tx.business.create({
        data: {
          name,
          businessType,
          services,
          monthlyProjectTarget,
          workingHoursStart,
          workingHoursEnd,
          currency,
          userId: user.id,
        },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { businessId: created.id },
      });
      return created;
    });

    return NextResponse.json({ business }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}