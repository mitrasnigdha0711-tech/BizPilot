import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import type { RecurringBillStatus, RecurringFrequency } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const EDITOR_ROLES = ['freelance_video_editor', 'FREELANCE_VIDEO_EDITOR'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_NAME_LENGTH = 100;
const MAX_AMOUNT = 1_000_000;

const FREQUENCIES = new Map<string, RecurringFrequency>([
  ['weekly', 'WEEKLY'],
  ['monthly', 'MONTHLY'],
  ['quarterly', 'QUARTERLY'],
  ['yearly', 'YEARLY'],
]);

const STATUSES = new Map<string, RecurringBillStatus>([
  ['active', 'ACTIVE'],
  ['paused', 'PAUSED'],
  ['ended', 'ENDED'],
]);

type RouteContext = { params: { recurringBillId: string } };

function fail(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function isEditorRole(role: unknown): boolean {
  return typeof role === 'string' && EDITOR_ROLES.includes(role);
}

function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

async function gate(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (!isEditorRole(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return user;
}

async function findOwnedBill(recurringBillId: string, userId: string) {
  if (!UUID_RE.test(recurringBillId)) return null;
  return prisma.recurringBill.findFirst({
    where: { id: recurringBillId, userId },
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await gate(request);
  if (auth instanceof Response) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return fail('Invalid request body');
  }
  const input = body as Record<string, unknown>;

  const existing = await findOwnedBill(params.recurringBillId, auth.id);
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const data: Prisma.RecurringBillUpdateInput = {};
  let frequencyChanged = false;
  let startChanged = false;

  if ('name' in input) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name) return fail('Please enter a name for this bill.');
    if (name.length > MAX_NAME_LENGTH) {
      return fail('Bill name must be 100 characters or fewer.');
    }
    data.name = name;
  }

  if ('amount' in input) {
    const amount =
      typeof input.amount === 'number'
        ? input.amount
        : typeof input.amount === 'string'
          ? Number(input.amount)
          : Number.NaN;
    if (!(amount > 0 && amount <= MAX_AMOUNT)) {
      return fail('Enter an amount between 0.01 and 1,000,000.');
    }
    data.amount = amount;
  }

  if ('frequency' in input) {
    const key = typeof input.frequency === 'string' ? input.frequency.toLowerCase() : '';
    const frequency = FREQUENCIES.get(key);
    if (!frequency) return fail('Choose how often this bill repeats.');
    data.frequency = frequency;
    frequencyChanged = frequency !== existing.frequency;
  }

  let effectiveStart: Date = existing.startDate;
  if ('startDate' in input) {
    const startDate = parseDay(input.startDate);
    if (!startDate) return fail('Please choose a start date for this bill.');
    data.startDate = startDate;
    effectiveStart = startDate;
    startChanged = startDate.getTime() !== existing.startDate.getTime();
  }

  let effectiveEnd: Date | null = existing.endDate;
  if ('endDate' in input) {
    if (input.endDate === null || input.endDate === '') {
      data.endDate = null;
      effectiveEnd = null;
    } else {
      const endDate = parseDay(input.endDate);
      if (!endDate) {
        return fail("End date must be after the start date, or leave it empty for an ongoing bill.");
      }
      data.endDate = endDate;
      effectiveEnd = endDate;
    }
  }

  if (effectiveEnd && effectiveEnd.getTime() <= effectiveStart.getTime()) {
    return fail(
      'End date must be after the start date, or leave it empty for an ongoing bill.',
    );
  }

  if ('status' in input) {
    const key = typeof input.status === 'string' ? input.status.toLowerCase() : '';
    const status = STATUSES.get(key);
    if (!status) return fail('Choose a valid status for this bill.');
    data.status = status;
  }

  if (frequencyChanged || startChanged) {
    data.nextDueDate = effectiveStart;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ recurringBill: existing });
  }

  try {
    const recurringBill = await prisma.recurringBill.update({
      where: { id: existing.id },
      data,
    });
    return NextResponse.json({ recurringBill });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const auth = await gate(request);
  if (auth instanceof Response) return auth;

  const existing = await findOwnedBill(params.recurringBillId, auth.id);
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    await prisma.recurringBill.delete({ where: { id: existing.id } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}