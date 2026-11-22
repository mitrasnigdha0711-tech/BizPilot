import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import type { Goal } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const FREELANCER = 'FREELANCE_VIDEO_EDITOR';
const OWNER = 'SMALL_VIDEO_EDITING_BUSINESS_OWNER';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

type Ctx = { params: { goalId: string } };
type GoalStatusValue = 'ACTIVE' | 'ACHIEVED' | 'MISSED';
type DbUser = { id: string; role: string; businessId: string | null };

function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function requestDay(request: Request): Date {
  const q = new URL(request.url).searchParams.get('date');
  const raw = q && DAY_RE.test(q) ? q : localToday();
  return new Date(`${raw}T00:00:00Z`);
}

function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !DAY_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function handleError(e: unknown): Response {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  console.error(e);
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}

async function loadDbUser(userId: string): Promise<DbUser | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, businessId: true, isActive: true },
  });
  if (!u || !u.isActive) return null;
  return { id: u.id, role: u.role, businessId: u.businessId };
}

async function guard(request: Request, allowed: readonly string[]): Promise<DbUser | Response> {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  const dbUser = await loadDbUser(auth.id);
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!allowed.includes(dbUser.role)) {
    return NextResponse.json({ error: 'Not available for your role' }, { status: 403 });
  }
  return dbUser;
}

async function ownerBusinessId(dbUser: DbUser): Promise<string | null> {
  if (dbUser.businessId) return dbUser.businessId;
  const business = await prisma.business.findFirst({
    where: { userId: dbUser.id },
    select: { id: true },
  });
  return business?.id ?? null;
}

async function findScopedGoal(id: string, dbUser: DbUser): Promise<Goal | null> {
  if (dbUser.role === FREELANCER) {
    return prisma.goal.findFirst({ where: { id, userId: dbUser.id } });
  }
  const businessId = await ownerBusinessId(dbUser);
  if (!businessId) return null;
  return prisma.goal.findFirst({ where: { id, businessId } });
}

async function countCompleted(businessId: string, start: Date, end: Date): Promise<number> {
  return prisma.project.count({
    where: {
      businessId,
      status: 'COMPLETED',
      completedAt: { gte: start, lt: new Date(end.getTime() + DAY_MS) },
    },
  });
}

function deriveStatus(
  completed: number,
  target: number,
  periodEnd: Date,
  today: Date,
): GoalStatusValue {
  if (completed >= target) return 'ACHIEVED';
  if (periodEnd.getTime() < today.getTime()) return 'MISSED';
  return 'ACTIVE';
}

async function syncGoal(goal: Goal, today: Date): Promise<Goal> {
  const completed = await countCompleted(goal.businessId, goal.periodStart, goal.periodEnd);
  const status = deriveStatus(completed, goal.targetProjectCount, goal.periodEnd, today);
  if (completed === goal.completedCount && status === goal.status) return goal;
  return prisma.goal.update({
    where: { id: goal.id },
    data: { completedCount: completed, status },
  });
}

export async function GET(request: Request, { params }: Ctx) {
  try {
    const dbUser = await guard(request, [FREELANCER, OWNER]);
    if (dbUser instanceof Response) return dbUser;
    if (!UUID_RE.test(params.goalId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const goal = await findScopedGoal(params.goalId, dbUser);
    if (!goal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const synced = await syncGoal(goal, requestDay(request));
    return NextResponse.json({ goal: synced });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const dbUser = await guard(request, [OWNER]);
    if (dbUser instanceof Response) return dbUser;
    if (!UUID_RE.test(params.goalId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const body = raw as Record<string, unknown>;

    const goal = await findScopedGoal(params.goalId, dbUser);
    if (!goal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const today = requestDay(request);
    const touchesPeriodOrTarget =
      'targetProjectCount' in body || 'periodStart' in body || 'periodEnd' in body;
    if (goal.periodEnd.getTime() < today.getTime() && touchesPeriodOrTarget) {
      return NextResponse.json(
        { error: "This goal's period has already ended, so its target and period can no longer change." },
        { status: 409 },
      );
    }

    const data: {
      title?: string;
      periodStart?: Date;
      periodEnd?: Date;
      targetProjectCount?: number;
    } = {};

    if ('title' in body) {
      if (typeof body.title !== 'string' || body.title.trim() === '') {
        return NextResponse.json({ error: 'Enter a goal title.' }, { status: 400 });
      }
      data.title = body.title.trim();
    }

    if ('targetProjectCount' in body) {
      const v = body.targetProjectCount;
      if (v === null || v === '' || v === undefined) {
        return NextResponse.json(
          { error: 'Enter a monthly project target to save your goal.' },
          { status: 400 },
        );
      }
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 50) {
        return NextResponse.json(
          { error: 'Enter a whole number of projects between 1 and 50.' },
          { status: 400 },
        );
      }
      data.targetProjectCount = v;
    }

    if ('periodStart' in body) {
      const d = parseDay(body.periodStart);
      if (!d) return NextResponse.json({ error: 'Select a valid month for this goal.' }, { status: 400 });
      data.periodStart = d;
    }

    if ('periodEnd' in body) {
      const d = parseDay(body.periodEnd);
      if (!d) return NextResponse.json({ error: 'Select a valid month for this goal.' }, { status: 400 });
      data.periodEnd = d;
    }

    const newStart = data.periodStart ?? goal.periodStart;
    const newEnd = data.periodEnd ?? goal.periodEnd;
    if (newEnd.getTime() <= newStart.getTime()) {
      return NextResponse.json({ error: 'The period must end after it starts.' }, { status: 400 });
    }

    if (data.periodStart) {
      const y = newStart.getUTCFullYear();
      const m = newStart.getUTCMonth();
      const monthStart = new Date(Date.UTC(y, m, 1));
      const nextMonth = new Date(Date.UTC(y, m + 1, 1));
      const clash = await prisma.goal.findFirst({
        where: {
          businessId: goal.businessId,
          id: { not: goal.id },
          periodStart: { gte: monthStart, lt: nextMonth },
        },
        select: { id: true },
      });
      if (clash) {
        return NextResponse.json(
          { error: 'This business already has a goal for that month.' },
          { status: 409 },
        );
      }
    }

    const completed = await countCompleted(goal.businessId, newStart, newEnd);
    const target = data.targetProjectCount ?? goal.targetProjectCount;
    const status = deriveStatus(completed, target, newEnd, today);

    const updated = await prisma.goal.update({
      where: { id: goal.id },
      data: { ...data, completedCount: completed, status },
    });
    return NextResponse.json({ goal: updated });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const dbUser = await guard(request, [OWNER]);
    if (dbUser instanceof Response) return dbUser;
    if (!UUID_RE.test(params.goalId)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const goal = await findScopedGoal(params.goalId, dbUser);
    if (!goal) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.$transaction([
      prisma.task.updateMany({ where: { goalId: goal.id }, data: { goalId: null } }),
      prisma.goal.delete({ where: { id: goal.id } }),
    ]);

    return NextResponse.json({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}