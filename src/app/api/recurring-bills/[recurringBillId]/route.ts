import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const ROLE_FREELANCE = 'freelance_video_editor';
const ROLE_OWNER = 'small_video_editing_business_owner';
const ALLOWED_ROLES: string[] = [ROLE_FREELANCE, ROLE_OWNER];

const FREQUENCIES = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const;
type Frequency = (typeof FREQUENCIES)[number];

const STATUSES = ['ACTIVE', 'PAUSED', 'ENDED'] as const;
type BillStatus = (typeof STATUSES)[number];

const MSG_NAME_REQUIRED = 'Please enter a name for this bill.';
const MSG_NAME_LENGTH = 'Bill name must be 100 characters or fewer.';
const MSG_AMOUNT = 'Enter an amount between 0.01 and 1,000,000.';
const MSG_FREQUENCY = 'Choose how often this bill repeats.';
const MSG_START = 'Please choose a start date for this bill.';
const MSG_END = 'End date must be after the start date, or leave it empty for an ongoing bill.';

type Me = { id: string; role: string; businessId: string | null };

type BillRecord = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  amount: Prisma.Decimal;
  frequency: string;
  startDate: Date;
  endDate: Date | null;
  nextDueDate: Date;
  lastPaidAt: Date | null;
  status: string;
  businessId: string;
  userId: string;
};

type UpdateResult = { data: Prisma.RecurringBillUpdateInput } | { error: string };

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isFrequency(value: string): value is Frequency {
  return (FREQUENCIES as readonly string[]).includes(value);
}

function isStatus(value: string): value is BillStatus {
  return (STATUSES as readonly string[]).includes(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || toDay(d) !== value) return null;
  return d;
}

function todayFrom(request: Request): Date {
  const fromQuery = parseDay(new URL(request.url).searchParams.get('date') ?? '');
  if (fromQuery) return fromQuery;
  const local = parseDay(new Date().toLocaleDateString('en-CA'));
  return local ?? new Date(0);
}

function addFrequency(d: Date, f: Frequency): Date {
  const next = new Date(d);
  switch (f) {
    case 'WEEKLY':
      next.setUTCDate(next.getUTCDate() + 7);
      break;
    case 'MONTHLY':
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case 'QUARTERLY':
      next.setUTCMonth(next.getUTCMonth() + 3);
      break;
    case 'YEARLY':
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      break;
  }
  return next;
}

function nextOccurrenceOnOrAfter(start: Date, f: Frequency, today: Date): Date {
  let d = new Date(start);
  while (d < today) {
    d = addFrequency(d, f);
  }
  return d;
}

function isNotFoundError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025';
}

function serialize(bill: BillRecord) {
  return {
    id: bill.id,
    name: bill.name,
    amount: Number(bill.amount.toString()),
    frequency: bill.frequency.toLowerCase(),
    startDate: toDay(bill.startDate),
    endDate: bill.endDate ? toDay(bill.endDate) : null,
    nextDueDate: toDay(bill.nextDueDate),
    lastPaidAt: bill.lastPaidAt ? bill.lastPaidAt.toISOString() : null,
    status: bill.status.toLowerCase(),
    businessId: bill.businessId,
    userId: bill.userId,
    createdAt: bill.createdAt.toISOString(),
    updatedAt: bill.updatedAt.toISOString(),
  };
}

async function authorize(request: Request): Promise<Me | Response> {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, role: true, businessId: true, isActive: true },
  });
  if (!row || !row.isActive) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = String(row.role).toLowerCase();
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return { id: row.id, role, businessId: row.businessId };
}

async function findScopedBill(id: string, me: Me): Promise<BillRecord | null> {
  if (me.role === ROLE_FREELANCE) {
    return prisma.recurringBill.findFirst({ where: { id, userId: me.id } });
  }
  if (!me.businessId) return null;
  return prisma.recurringBill.findFirst({ where: { id, businessId: me.businessId } });
}

function buildUpdate(body: Record<string, unknown>, current: BillRecord, today: Date): UpdateResult {
  const data: Prisma.RecurringBillUpdateInput = {};
  let startDate = current.startDate;
  let endDate = current.endDate;
  let frequency: Frequency = isFrequency(current.frequency) ? current.frequency : 'MONTHLY';
  let scheduleChanged = false;

  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return { error: MSG_NAME_REQUIRED };
    if (name.length > 100) return { error: MSG_NAME_LENGTH };
    data.name = name;
  }

  if ('amount' in body) {
    const amount = typeof body.amount === 'number' ? body.amount : Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      return { error: MSG_AMOUNT };
    }
    data.amount = amount;
  }

  if ('frequency' in body) {
    const f = typeof body.frequency === 'string' ? body.frequency.toUpperCase() : '';
    if (!isFrequency(f)) return { error: MSG_FREQUENCY };
    frequency = f;
    data.frequency = f;
    scheduleChanged = true;
  }

  if ('startDate' in body) {
    const d = parseDay(body.startDate);
    if (!d) return { error: MSG_START };
    startDate = d;
    data.startDate = d;
    scheduleChanged = true;
  }

  if ('endDate' in body) {
    if (body.endDate === null || body.endDate === '') {
      endDate = null;
    } else {
      const d = parseDay(body.endDate);
      if (!d) return { error: MSG_END };
      endDate = d;
    }
    data.endDate = endDate;
  }

  if (endDate && endDate.getTime() <= startDate.getTime()) {
    return { error: MSG_END };
  }

  if ('status' in body) {
    const s = typeof body.status === 'string' ? body.status.toUpperCase() : '';
    if (!isStatus(s)) return { error: 'Invalid status for this bill.' };
    data.status = s;
  }

  if (scheduleChanged) {
    data.nextDueDate = nextOccurrenceOnOrAfter(startDate, frequency, today);
  }

  if (Object.keys(data).length === 0) {
    return { error: 'No changes provided.' };
  }

  return { data };
}

export async function GET(
  request: Request,
  { params }: { params: { recurringBillId: string } },
) {
  const me = await authorize(request);
  if (me instanceof Response) return me;

  const id = params.recurringBillId;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const bill = await findScopedBill(id, me);
    if (!bill) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ recurringBill: serialize(bill) });
  } catch (e) {
    if (isNotFoundError(e)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('GET /api/recurring-bills/[recurringBillId] failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { recurringBillId: string } },
) {
  const me = await authorize(request);
  if (me instanceof Response) return me;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!isPlainObject(body)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const id = params.recurringBillId;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let current: BillRecord | null;
  try {
    current = await findScopedBill(id, me);
  } catch (e) {
    console.error('PATCH /api/recurring-bills/[recurringBillId] lookup failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const result = buildUpdate(body, current, todayFrom(request));
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  try {
    const bill = await prisma.recurringBill.update({
      where: { id: current.id },
      data: result.data,
    });
    return NextResponse.json({ recurringBill: serialize(bill) });
  } catch (e) {
    if (isNotFoundError(e)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('PATCH /api/recurring-bills/[recurringBillId] failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { recurringBillId: string } },
) {
  const me = await authorize(request);
  if (me instanceof Response) return me;

  const id = params.recurringBillId;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const current = await findScopedBill(id, me);
    if (!current) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    await prisma.recurringBill.delete({ where: { id: current.id } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (isNotFoundError(e)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('DELETE /api/recurring-bills/[recurringBillId] failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}