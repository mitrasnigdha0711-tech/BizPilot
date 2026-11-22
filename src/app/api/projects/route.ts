import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_ROLES = ['freelance_video_editor', 'small_video_editing_business_owner'];

function isValidDay(value: string): boolean {
  if (!DAY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function serverLocalToday(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toDayDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = String(dbUser.role).toLowerCase();
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const body = raw as Record<string, unknown>;

  if (!dbUser.businessId) {
    return NextResponse.json(
      { error: 'Complete business setup before creating projects.' },
      { status: 400 },
    );
  }

  // Name
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'Enter a project name.' }, { status: 400 });
  }

  // Status: new projects always start as planned
  if (body.status !== undefined && body.status !== null && body.status !== 'planned') {
    return NextResponse.json(
      {
        error:
          'Choose a valid status. Projects move from planning to in progress, then in review, then completed.',
      },
      { status: 400 },
    );
  }

  // Client: required, must exist in caller's business (and be owned by caller for freelancers)
  const clientId = typeof body.clientId === 'string' ? body.clientId.trim() : '';
  if (!clientId) {
    return NextResponse.json(
      { error: 'Please select a client for this project.' },
      { status: 400 },
    );
  }

  const isFreelancer = role === 'FREELANCE_VIDEO_EDITOR';
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      businessId: dbUser.businessId,
      ...(isFreelancer ? { userId: user.id } : {}),
    },
    select: { id: true },
  });
  if (!client) {
    return NextResponse.json(
      { error: 'Please select a client for this project.' },
      { status: 400 },
    );
  }

  // Value: required, numeric, >= 0
  let value: number;
  if (typeof body.value === 'number') {
    value = body.value;
  } else if (typeof body.value === 'string' && body.value.trim() !== '') {
    value = Number(body.value);
  } else {
    value = Number.NaN;
  }
  if (!Number.isFinite(value) || value < 0) {
    return NextResponse.json(
      { error: 'Please enter a project value of 0 or more.' },
      { status: 400 },
    );
  }
  const roundedValue = Math.round(value * 100) / 100;

  // Start date: optional calendar day
  let startDate: Date | null = null;
  let startDay: string | null = null;
  if (body.startDate !== undefined && body.startDate !== null && body.startDate !== '') {
    if (typeof body.startDate !== 'string' || !isValidDay(body.startDate)) {
      return NextResponse.json(
        { error: 'Enter a deadline on or after the project start date.' },
        { status: 400 },
      );
    }
    startDay = body.startDate;
    startDate = toDayDate(body.startDate);
  }

  // Deadline: required, today or later, not before start date
  const today = (() => {
    const requested = new URL(request.url).searchParams.get('date');
    return requested && isValidDay(requested) ? requested : serverLocalToday();
  })();

  if (typeof body.deadline !== 'string' || !isValidDay(body.deadline)) {
    return NextResponse.json(
      { error: 'Please choose a deadline today or later.' },
      { status: 400 },
    );
  }
  const deadlineDay = body.deadline;

  if (deadlineDay < today) {
    return NextResponse.json(
      { error: 'Please choose a deadline today or later.' },
      { status: 400 },
    );
  }

  if (startDay !== null && deadlineDay < startDay) {
    return NextResponse.json(
      { error: 'Enter a deadline on or after the project start date.' },
      { status: 400 },
    );
  }

  try {
    const project = await prisma.project.create({
      data: {
        name,
        clientId: client.id,
        status: 'PLANNED',
        startDate,
        deadline: toDayDate(deadlineDay),
        value: roundedValue,
        businessId: dbUser.businessId,
        userId: user.id,
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}