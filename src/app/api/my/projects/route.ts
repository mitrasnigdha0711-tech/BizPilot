import { NextResponse } from 'next/server';
import { Prisma, ProjectStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

type ProjectRow = {
  id: string;
  name: string;
  clientId: string;
  status: ProjectStatus;
  startDate: Date | null;
  deadline: Date;
  value: Prisma.Decimal | null;
  completedAt: Date | null;
  client: { name: string };
};

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_PATTERN.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function dateToDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayFromRequest(request: Request): string {
  const param = new URL(request.url).searchParams.get('date');
  if (isValidDay(param)) return param;
  return new Date().toLocaleDateString('en-CA');
}

function toWire(p: ProjectRow, today: string) {
  const deadline = dateToDay(p.deadline);
  const isCompleted = p.status === ProjectStatus.COMPLETED;
  return {
    id: p.id,
    name: p.name,
    clientId: p.clientId,
    clientName: p.client.name,
    status: p.status.toLowerCase(),
    startDate: p.startDate ? dateToDay(p.startDate) : null,
    deadline,
    value: p.value === null ? null : p.value.toNumber(),
    completedAt: p.completedAt ? p.completedAt.toISOString() : null,
    isOverdue: !isCompleted && deadline < today,
  };
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, businessId: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (dbUser.role !== Role.FREELANCE_VIDEO_EDITOR) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!dbUser.businessId) {
    return NextResponse.json({ projects: [] });
  }

  try {
    const rows = await prisma.project.findMany({
      where: { userId: user.id, businessId: dbUser.businessId },
      orderBy: { deadline: 'asc' },
      include: { client: { select: { name: true } } },
    });

    // Undelivered (not completed) projects first, then nearest deadline first.
    const sorted = [...rows].sort((a, b) => {
      const aDone = a.status === ProjectStatus.COMPLETED ? 1 : 0;
      const bDone = b.status === ProjectStatus.COMPLETED ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return a.deadline.getTime() - b.deadline.getTime();
    });

    const today = todayFromRequest(request);
    return NextResponse.json({ projects: sorted.map((p) => toWire(p, today)) });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, businessId: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (dbUser.role !== Role.FREELANCE_VIDEO_EDITOR) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;

  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name || name.length > 120) {
    return NextResponse.json({ error: 'Enter a project name of up to 120 characters.' }, { status: 400 });
  }

  const clientId = typeof raw.clientId === 'string' ? raw.clientId.trim() : '';
  if (!clientId) {
    return NextResponse.json({ error: 'Please select a client for this project.' }, { status: 400 });
  }

  const today = todayFromRequest(request);

  if (!isValidDay(raw.deadline) || raw.deadline < today) {
    return NextResponse.json({ error: 'Please choose a deadline today or later.' }, { status: 400 });
  }
  const deadline = raw.deadline;

  let startDate: string | null = null;
  if (raw.startDate !== undefined && raw.startDate !== null && raw.startDate !== '') {
    if (!isValidDay(raw.startDate)) {
      return NextResponse.json({ error: 'Enter a deadline on or after the project start date.' }, { status: 400 });
    }
    startDate = raw.startDate;
    if (deadline < startDate) {
      return NextResponse.json({ error: 'Enter a deadline on or after the project start date.' }, { status: 400 });
    }
  }

  let value: number;
  if (typeof raw.value === 'number') {
    value = raw.value;
  } else if (typeof raw.value === 'string' && raw.value.trim() !== '') {
    value = Number(raw.value);
  } else {
    value = Number.NaN;
  }
  if (!Number.isFinite(value) || value < 0) {
    return NextResponse.json({ error: 'Please enter a project value of 0 or more.' }, { status: 400 });
  }

  if (!dbUser.businessId) {
    return NextResponse.json({ error: 'Set up your business before adding projects.' }, { status: 400 });
  }
  const businessId = dbUser.businessId;

  try {
    const client = await prisma.client.findFirst({
      where: { id: clientId, businessId },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json({ error: 'Please select a client for this project.' }, { status: 400 });
    }

    const created = await prisma.project.create({
      data: {
        name,
        clientId,
        status: ProjectStatus.PLANNED,
        startDate: startDate ? dayToDate(startDate) : null,
        deadline: dayToDate(deadline),
        value,
        businessId,
        userId: user.id,
      },
      include: { client: { select: { name: true } } },
    });

    return NextResponse.json({ project: toWire(created, today) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}