import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const ALLOWED_ROLES = ['freelance_video_editor', 'small_video_editing_business_owner'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const CURRENCY_RE = /^[A-Z]{3}$/;

async function getCallerRole(userId: string): Promise<string | null> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!dbUser) return null;
  // Prisma returns enum identifiers (FREELANCE_VIDEO_EDITOR); the users table
  // stores the lowercase values listed in ALLOWED_ROLES.
  return String(dbUser.role).toLowerCase();
}

async function findScopedBusiness(businessId: string, userId: string) {
  return prisma.business.findFirst({
    where: {
      id: businessId,
      OR: [{ userId }, { members: { some: { id: userId } } }],
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: { businessId: string } }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const role = await getCallerRole(user.id);
  if (!role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const businessId = params.businessId;
  if (!UUID_RE.test(businessId)) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  try {
    const business = await findScopedBusiness(businessId, user.id);
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    return NextResponse.json({ business });
  } catch (e) {
    console.error('GET /api/businesses/[businessId] failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { businessId: string } }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const role = await getCallerRole(user.id);
  if (!role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const businessId = params.businessId;
  if (!UUID_RE.test(businessId)) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const data: Prisma.BusinessUpdateInput = {};

  if (input.name !== undefined) {
    if (typeof input.name !== 'string' || input.name.trim() === '') {
      return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 });
    }
    data.name = input.name.trim();
  }

  if (input.services !== undefined) {
    if (!Array.isArray(input.services) || !input.services.every((s) => typeof s === 'string')) {
      return NextResponse.json({ error: 'services must be an array of strings' }, { status: 400 });
    }
    data.services = input.services as Prisma.InputJsonValue;
  }

  if (input.monthlyProjectTarget !== undefined) {
    const target = input.monthlyProjectTarget;
    if (typeof target !== 'number' || !Number.isInteger(target) || target <= 0) {
      return NextResponse.json(
        { error: 'monthlyProjectTarget must be a positive whole number' },
        { status: 400 }
      );
    }
    data.monthlyProjectTarget = target;
  }

  if (input.workingHoursStart !== undefined) {
    if (typeof input.workingHoursStart !== 'string' || !TIME_RE.test(input.workingHoursStart)) {
      return NextResponse.json({ error: 'workingHoursStart must be HH:mm' }, { status: 400 });
    }
    data.workingHoursStart = input.workingHoursStart;
  }

  if (input.workingHoursEnd !== undefined) {
    if (typeof input.workingHoursEnd !== 'string' || !TIME_RE.test(input.workingHoursEnd)) {
      return NextResponse.json({ error: 'workingHoursEnd must be HH:mm' }, { status: 400 });
    }
    data.workingHoursEnd = input.workingHoursEnd;
  }

  if (input.currency !== undefined) {
    if (typeof input.currency !== 'string' || !CURRENCY_RE.test(input.currency)) {
      return NextResponse.json({ error: 'currency must be a 3-letter ISO code' }, { status: 400 });
    }
    data.currency = input.currency;
  }

  try {
    const existing = await findScopedBusiness(businessId, user.id);
    if (!existing) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const start = (data.workingHoursStart as string | undefined) ?? existing.workingHoursStart;
    const end = (data.workingHoursEnd as string | undefined) ?? existing.workingHoursEnd;
    if (start >= end) {
      return NextResponse.json(
        { error: 'workingHoursStart must be earlier than workingHoursEnd' },
        { status: 400 }
      );
    }

    if (data.currency !== undefined && data.currency !== existing.currency) {
      const invoiceCount = await prisma.invoice.count({ where: { businessId: existing.id } });
      if (invoiceCount > 0) {
        return NextResponse.json(
          {
            error: `Currency cannot be changed once invoices exist; current value ${existing.currency} is kept`,
          },
          { status: 409 }
        );
      }
    }

    const business = await prisma.business.update({
      where: { id: existing.id },
      data,
    });
    return NextResponse.json({ business });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('PATCH /api/businesses/[businessId] failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}