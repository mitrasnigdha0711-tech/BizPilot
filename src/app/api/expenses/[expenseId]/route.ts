import { NextResponse } from 'next/server';
import { Prisma, Role, type Expens } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT = 1_000_000;
const MAX_DESCRIPTION = 200;

type Scope = {
  userId: string;
  businessId: string;
  role: Role;
};

type ExpenseWire = {
  id: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  amount: number;
  category: string;
  expenseDate: string;
  projectId: string | null;
  businessId: string;
  userId: string;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

async function resolveScope(request: Request): Promise<Scope | Response> {
  const sessionUser = await requireUser(request);
  if (sessionUser instanceof Response) return sessionUser;

  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, role: true, businessId: true },
  });
  if (!dbUser) {
    return json({ error: 'Unauthorized' }, 401);
  }
  if (dbUser.role !== Role.FREELANCE_VIDEO_EDITOR && dbUser.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
    return json({ error: 'Forbidden' }, 403);
  }
  if (!dbUser.businessId) {
    return json({ error: 'Not found' }, 404);
  }
  return { userId: dbUser.id, businessId: dbUser.businessId, role: dbUser.role };
}

async function findExpense(scope: Scope, expenseId: string): Promise<Expens | null> {
  return prisma.expens.findFirst({
    where: {
      id: expenseId,
      businessId: scope.businessId,
      ...(scope.role === Role.FREELANCE_VIDEO_EDITOR ? { userId: scope.userId } : {}),
    },
  });
}

function serialize(e: Expens): ExpenseWire {
  return {
    id: e.id,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    description: e.description,
    amount: Number(e.amount),
    category: e.category,
    expenseDate: e.expenseDate.toISOString().slice(0, 10),
    projectId: e.projectId,
    businessId: e.businessId,
    userId: e.userId,
  };
}

function isValidDay(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isPrismaNotFound(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025';
}

export async function GET(
  request: Request,
  { params }: { params: { expenseId: string } }
) {
  try {
    const scope = await resolveScope(request);
    if (scope instanceof Response) return scope;

    const expenseId = params.expenseId;
    if (!UUID_RE.test(expenseId)) {
      return json({ error: 'Not found' }, 404);
    }

    const expense = await findExpense(scope, expenseId);
    if (!expense) {
      return json({ error: 'Not found' }, 404);
    }

    return json({ expense: serialize(expense) });
  } catch (e) {
    if (isPrismaNotFound(e)) {
      return json({ error: 'Not found' }, 404);
    }
    return json({ error: 'Internal error' }, 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { expenseId: string } }
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const input = body as Record<string, unknown>;

  try {
    const scope = await resolveScope(request);
    if (scope instanceof Response) return scope;

    const expenseId = params.expenseId;
    if (!UUID_RE.test(expenseId)) {
      return json({ error: 'Not found' }, 404);
    }

    const existing = await findExpense(scope, expenseId);
    if (!existing) {
      return json({ error: 'Not found' }, 404);
    }

    const data: Prisma.ExpensUpdateInput = {};

    if (input.description !== undefined) {
      if (typeof input.description !== 'string' || input.description.trim().length > MAX_DESCRIPTION) {
        return json({ error: 'Description must be 200 characters or fewer.' }, 400);
      }
      data.description = input.description.trim();
    }

    if (input.amount !== undefined) {
      const amount =
        typeof input.amount === 'number'
          ? input.amount
          : typeof input.amount === 'string' && input.amount.trim() !== ''
            ? Number(input.amount)
            : NaN;
      if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
        return json({ error: 'Enter an amount greater than 0.' }, 400);
      }
      data.amount = amount;
    }

    if (input.category !== undefined) {
      if (typeof input.category !== 'string' || input.category.trim() === '') {
        return json({ error: 'Select a category for this expense.' }, 400);
      }
      data.category = input.category.trim();
    }

    if (input.expenseDate !== undefined) {
      const day = typeof input.expenseDate === 'string' ? input.expenseDate : '';
      const today = new Date().toISOString().slice(0, 10);
      if (!isValidDay(day) || day > today) {
        return json({ error: 'Choose a date on or before today.' }, 400);
      }
      data.expenseDate = new Date(`${day}T00:00:00Z`);
    }

    if (input.projectId !== undefined) {
      if (input.projectId === null || input.projectId === '') {
        data.project = { disconnect: true };
      } else {
        if (typeof input.projectId !== 'string' || !UUID_RE.test(input.projectId)) {
          return json({ error: "Choose one of your existing projects, or leave this blank." }, 400);
        }
        const project = await prisma.project.findFirst({
          where: { id: input.projectId, userId: existing.userId, businessId: existing.businessId },
          select: { id: true },
        });
        if (!project) {
          return json({ error: "Choose one of your existing projects, or leave this blank." }, 400);
        }
        data.project = { connect: { id: project.id } };
      }
    }

    if (Object.keys(data).length === 0) {
      return json({ error: 'No changes provided' }, 400);
    }

    const updated = await prisma.expens.update({
      where: { id: existing.id },
      data,
    });

    return json({ expense: serialize(updated) });
  } catch (e) {
    if (isPrismaNotFound(e)) {
      return json({ error: 'Not found' }, 404);
    }
    return json({ error: 'Internal error' }, 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { expenseId: string } }
) {
  try {
    const scope = await resolveScope(request);
    if (scope instanceof Response) return scope;

    const expenseId = params.expenseId;
    if (!UUID_RE.test(expenseId)) {
      return json({ error: 'Not found' }, 404);
    }

    const existing = await findExpense(scope, expenseId);
    if (!existing) {
      return json({ error: 'Not found' }, 404);
    }

    await prisma.expens.delete({ where: { id: existing.id } });

    return json({ deleted: true });
  } catch (e) {
    if (isPrismaNotFound(e)) {
      return json({ error: 'Not found' }, 404);
    }
    return json({ error: 'Internal error' }, 500);
  }
}