import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const OWNER_ROLE = 'small_video_editing_business_owner';
const MAX_AMOUNT = 1000000;
const MAX_DESCRIPTION_LENGTH = 200;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type RouteContext = { params: { expenseId: string } };

type ExpenseUpdate = Prisma.ExpensUncheckedUpdateInput;

type ParseResult = { data: ExpenseUpdate } | { error: string };

function localTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function ownerBusinessId(
  request: Request,
): Promise<{ businessId: string } | Response> {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (user.role !== OWNER_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { businessId: true },
  });

  if (!me?.businessId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return { businessId: me.businessId };
}

async function parseUpdate(
  body: Record<string, unknown>,
  businessId: string,
): Promise<ParseResult> {
  const data: ExpenseUpdate = {};

  if ('amount' in body) {
    const raw = body.amount;
    const amount =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string' && raw.trim() !== ''
          ? Number(raw)
          : NaN;
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
      return { error: 'Enter an amount greater than 0.' };
    }
    data.amount = amount.toFixed(2);
  }

  if ('expenseDate' in body) {
    const raw = body.expenseDate;
    if (typeof raw !== 'string' || !DATE_PATTERN.test(raw)) {
      return { error: 'Choose a date on or before today.' };
    }
    const parsed = new Date(`${raw}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw) {
      return { error: 'Choose a date on or before today.' };
    }
    if (raw > localTodayString()) {
      return { error: 'Choose a date on or before today.' };
    }
    data.expenseDate = parsed;
  }

  if ('category' in body) {
    const raw = body.category;
    if (typeof raw !== 'string' || raw.trim() === '') {
      return { error: 'Select a category for this expense.' };
    }
    data.category = raw.trim();
  }

  if ('description' in body) {
    const raw = body.description;
    if (raw !== null && raw !== undefined && typeof raw !== 'string') {
      return { error: 'Description must be 200 characters or fewer.' };
    }
    const description = typeof raw === 'string' ? raw.trim() : '';
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return { error: 'Description must be 200 characters or fewer.' };
    }
    data.description = description;
  }

  if ('projectId' in body) {
    const raw = body.projectId;
    if (raw === null || raw === undefined || raw === '') {
      data.projectId = null;
    } else if (typeof raw === 'string') {
      const project = await prisma.project.findFirst({
        where: { id: raw, businessId },
        select: { id: true },
      });
      if (!project) {
        return {
          error: 'Choose one of your existing projects, or leave this blank.',
        };
      }
      data.projectId = project.id;
    } else {
      return {
        error: 'Choose one of your existing projects, or leave this blank.',
      };
    }
  }

  return { data };
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const scope = await ownerBusinessId(request);
  if (scope instanceof Response) return scope;
  const { businessId } = scope;
  const expenseId = params.expenseId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const parsed = await parseUpdate(body as Record<string, unknown>, businessId);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json(
        { error: 'No changes provided' },
        { status: 400 },
      );
    }

    const existing = await prisma.expens.findFirst({
      where: { id: expenseId, businessId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const expense = await prisma.expens.update({
      where: { id: expenseId },
      data: parsed.data,
    });

    return NextResponse.json({ expense });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const scope = await ownerBusinessId(request);
  if (scope instanceof Response) return scope;
  const { businessId } = scope;
  const expenseId = params.expenseId;

  try {
    const existing = await prisma.expens.findFirst({
      where: { id: expenseId, businessId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.expens.delete({ where: { id: expenseId } });

    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}