import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const ALLOWED_ROLES: string[] = ['FREELANCE_VIDEO_EDITOR', 'SMALL_VIDEO_EDITING_BUSINESS_OWNER'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AMOUNT = 1_000_000;
const MAX_DESCRIPTION_LENGTH = 200;
const MAX_CATEGORY_LENGTH = 100;

function isRealDay(day: string): boolean {
  if (!DAY_RE.test(day)) return false;
  const parsed = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const input = body as Record<string, unknown>;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, businessId: true, isActive: true },
    });
    if (!dbUser || !dbUser.isActive) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!ALLOWED_ROLES.includes(dbUser.role as string)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!dbUser.businessId) {
      return NextResponse.json(
        { error: 'Set up your business before recording expenses' },
        { status: 400 },
      );
    }

    // Amount: greater than 0 and no more than 1,000,000
    const rawAmount = input.amount;
    const amount =
      typeof rawAmount === 'number'
        ? rawAmount
        : typeof rawAmount === 'string' && rawAmount.trim() !== ''
          ? Number(rawAmount)
          : NaN;
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) {
      return NextResponse.json({ error: 'Enter an amount greater than 0.' }, { status: 400 });
    }

    // Expense date: required, valid YYYY-MM-DD, today or earlier
    const expenseDate = typeof input.expenseDate === 'string' ? input.expenseDate.trim() : '';
    if (!isRealDay(expenseDate)) {
      return NextResponse.json({ error: 'Choose a date on or before today.' }, { status: 400 });
    }
    const todayKey = new Date().toLocaleDateString('en-CA');
    if (expenseDate > todayKey) {
      return NextResponse.json({ error: 'Choose a date on or before today.' }, { status: 400 });
    }

    // Category: required
    const category = typeof input.category === 'string' ? input.category.trim() : '';
    if (!category || category.length > MAX_CATEGORY_LENGTH) {
      return NextResponse.json({ error: 'Select a category for this expense.' }, { status: 400 });
    }

    // Description: optional, at most 200 characters
    let description = '';
    if (input.description !== undefined && input.description !== null) {
      if (typeof input.description !== 'string') {
        return NextResponse.json(
          { error: 'Description must be 200 characters or fewer.' },
          { status: 400 },
        );
      }
      description = input.description.trim();
      if (description.length > MAX_DESCRIPTION_LENGTH) {
        return NextResponse.json(
          { error: 'Description must be 200 characters or fewer.' },
          { status: 400 },
        );
      }
    }

    // Project: optional, must belong to the same user
    let projectId: string | null = null;
    if (input.projectId !== undefined && input.projectId !== null && input.projectId !== '') {
      const candidate = typeof input.projectId === 'string' ? input.projectId.trim() : '';
      if (!UUID_RE.test(candidate)) {
        return NextResponse.json(
          { error: "Choose one of your existing projects, or leave this blank." },
          { status: 400 },
        );
      }
      const project = await prisma.project.findFirst({
        where: { id: candidate, userId: dbUser.id },
        select: { id: true },
      });
      if (!project) {
        return NextResponse.json(
          { error: "Choose one of your existing projects, or leave this blank." },
          { status: 400 },
        );
      }
      projectId = project.id;
    }

    const expense = await prisma.expens.create({
      data: {
        description,
        amount,
        category,
        expenseDate: new Date(`${expenseDate}T00:00:00Z`),
        projectId,
        businessId: dbUser.businessId,
        userId: dbUser.id,
      },
    });

    return NextResponse.json({ expense }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}