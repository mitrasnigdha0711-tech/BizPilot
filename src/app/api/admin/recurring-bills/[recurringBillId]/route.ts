import { NextResponse } from 'next/server';
import {
  Prisma,
  Role,
  RecurringFrequency,
  RecurringBillStatus,
} from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

type RouteContext = { params: { recurringBillId: string } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFrequency(value: unknown): value is RecurringFrequency {
  return (
    typeof value === 'string' &&
    (Object.values(RecurringFrequency) as string[]).includes(value)
  );
}

function isStatus(value: unknown): value is RecurringBillStatus {
  return (
    typeof value === 'string' &&
    (Object.values(RecurringBillStatus) as string[]).includes(value)
  );
}

function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const s = value.trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? new Date(`${s}T00:00:00Z`)
    : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function resolveOwnerBusinessId(userId: string): Promise<string | NextResponse> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, businessId: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (dbUser.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!dbUser.businessId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return dbUser.businessId;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const scope = await resolveOwnerBusinessId(user.id);
  if (scope instanceof NextResponse) return scope;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!isRecord(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const existing = await prisma.recurringBill.findFirst({
      where: { id: params.recurringBillId, businessId: scope },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const data: Prisma.RecurringBillUpdateInput = {};

    if ('name' in body) {
      if (typeof body.name !== 'string' || body.name.trim() === '') {
        return NextResponse.json(
          { error: 'Please enter a name for this bill.' },
          { status: 400 },
        );
      }
      const name = body.name.trim();
      if (name.length > 100) {
        return NextResponse.json(
          { error: 'Bill name must be 100 characters or fewer.' },
          { status: 400 },
        );
      }
      data.name = name;
    }

    if ('amount' in body) {
      const amount =
        typeof body.amount === 'string' && body.amount.trim() !== ''
          ? Number(body.amount)
          : body.amount;
      if (
        typeof amount !== 'number' ||
        !Number.isFinite(amount) ||
        amount < 0.01 ||
        amount > 1000000
      ) {
        return NextResponse.json(
          { error: 'Enter an amount between 0.01 and 1,000,000.' },
          { status: 400 },
        );
      }
      data.amount = amount;
    }

    if ('frequency' in body) {
      if (!isFrequency(body.frequency)) {
        return NextResponse.json(
          { error: 'Choose how often this bill repeats.' },
          { status: 400 },
        );
      }
      data.frequency = body.frequency;
    }

    if ('status' in body) {
      if (!isStatus(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      data.status = body.status;
    }

    let startDate = existing.startDate;
    let endDate = existing.endDate;
    let startChanged = false;

    if ('startDate' in body) {
      const parsed = parseDay(body.startDate);
      if (!parsed) {
        return NextResponse.json(
          { error: 'Please choose a start date for this bill.' },
          { status: 400 },
        );
      }
      startChanged = parsed.getTime() !== existing.startDate.getTime();
      startDate = parsed;
      data.startDate = startDate;
    }

    if ('endDate' in body) {
      if (body.endDate === null || body.endDate === '') {
        endDate = null;
      } else {
        const parsed = parseDay(body.endDate);
        if (!parsed) {
          return NextResponse.json(
            {
              error:
                'End date must be after the start date, or leave it empty for an ongoing bill.',
            },
            { status: 400 },
          );
        }
        endDate = parsed;
      }
      data.endDate = endDate;
    }

    if (endDate && endDate.getTime() <= startDate.getTime()) {
      return NextResponse.json(
        {
          error:
            'End date must be after the start date, or leave it empty for an ongoing bill.',
        },
        { status: 400 },
      );
    }

    if ('nextDueDate' in body) {
      const parsed = parseDay(body.nextDueDate);
      if (!parsed) {
        return NextResponse.json(
          { error: 'Invalid next due date' },
          { status: 400 },
        );
      }
      data.nextDueDate = parsed;
    } else if (startChanged) {
      data.nextDueDate = startDate;
    }

    const updated = await prisma.recurringBill.update({
      where: { id: existing.id },
      data,
    });

    return NextResponse.json({ recurringBill: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const scope = await resolveOwnerBusinessId(user.id);
  if (scope instanceof NextResponse) return scope;

  try {
    const existing = await prisma.recurringBill.findFirst({
      where: { id: params.recurringBillId, businessId: scope },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.recurringBill.delete({ where: { id: existing.id } });

    return new Response(null, { status: 204 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}