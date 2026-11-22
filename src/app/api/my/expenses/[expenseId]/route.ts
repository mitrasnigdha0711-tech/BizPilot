import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

type Params = { params: { expenseId: string } };

const MAX_AMOUNT = 1_000_000;
const MAX_DESCRIPTION_LENGTH = 200;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function todayFrom(request: Request): string {
  const day = new URL(request.url).searchParams.get('date');
  return day && DAY_PATTERN.test(day) ? day : new Date().toLocaleDateString('en-CA');
}

function toDayDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function isPrismaNotFound(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025';
}

export async function PATCH(request: Request, { params }: Params) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (user.role !== 'FREELANCE_VIDEO_EDITOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const data: Prisma.ExpensUncheckedUpdateInput = {};

  if ('description' in body) {
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return NextResponse.json(
        { error: 'Description must be 200 characters or fewer.' },
        { status: 400 },
      );
    }
    data.description = description;
  }

  if ('amount' in body) {
    const amount = typeof body.amount === 'string' ? Number(body.amount) : body.amount;
    if (
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > MAX_AMOUNT
    ) {
      return NextResponse.json(
        { error: 'Enter an amount greater than 0.' },
        { status: 400 },
      );
    }
    data.amount = amount;
  }

  if ('category' in body) {
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    if (!category) {
      return NextResponse.json(
        { error: 'Select a category for this expense.' },
        { status: 400 },
      );
    }
    data.category = category;
  }

  if ('expenseDate' in body) {
    const raw = typeof body.expenseDate === 'string' ? body.expenseDate.slice(0, 10) : '';
    if (!DAY_PATTERN.test(raw) || Number.isNaN(toDayDate(raw).getTime())) {
      return NextResponse.json(
        { error: 'Choose a date on or before today.' },
        { status: 400 },
      );
    }
    if (raw > todayFrom(request)) {
      return NextResponse.json(
        { error: 'Choose a date on or before today.' },
        { status: 400 },
      );
    }
    data.expenseDate = toDayDate(raw);
  }

  if ('projectId' in body) {
    if (body.projectId === null || body.projectId === '') {
      data.projectId = null;
    } else if (typeof body.projectId === 'string') {
      const project = await prisma.project.findFirst({
        where: { id: body.projectId, userId: user.id },
        select: { id: true },
      });
      if (!project) {
        return NextResponse.json(
          { error: "Choose one of your existing projects, or leave this blank." },
          { status: 400 },
        );
      }
      data.projectId = project.id;
    } else {
      return NextResponse.json(
        { error: "Choose one of your existing projects, or leave this blank." },
        { status: 400 },
      );
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  try {
    const existing = await prisma.expens.findFirst({
      where: { id: params.expenseId, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const expense = await prisma.expens.update({
      where: { id: existing.id },
      data,
    });
    return NextResponse.json({ expense });
  } catch (e) {
    if (isPrismaNotFound(e)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (user.role !== 'FREELANCE_VIDEO_EDITOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const existing = await prisma.expens.findFirst({
      where: { id: params.expenseId, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.expens.delete({ where: { id: existing.id } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (isPrismaNotFound(e)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}