import { NextResponse } from 'next/server';
import { Prisma, ProjectStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const OWNER_ROLE = 'small_video_editing_business_owner';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

type ProjectRow = Prisma.ProjectGetPayload<{
  include: { client: { select: { id: true; name: true } } };
}>;

function serverToday(): string {
  return new Date().toLocaleDateString('en-CA');
}

function isValidDay(value: string): boolean {
  if (!DAY_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function toDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return toDay(d);
}

function serializeProject(p: ProjectRow, today: string) {
  const deadline = toDay(p.deadline);
  const status = p.status.toLowerCase();
  const closed = p.status === ProjectStatus.COMPLETED || p.status === ProjectStatus.CANCELLED;
  const isOverdue = !closed && deadline < today;
  const isDueSoon = !closed && !isOverdue && deadline <= addDays(today, 7);

  return {
    id: p.id,
    name: p.name,
    status,
    startDate: p.startDate ? toDay(p.startDate) : null,
    deadline,
    value: p.value === null ? null : Number(p.value),
    completedAt: p.completedAt ? p.completedAt.toISOString() : null,
    client: { id: p.client.id, name: p.client.name },
    clientId: p.clientId,
    isOverdue,
    isDueSoon,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

async function loadOwnerBusiness(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, businessId: true },
  });
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const owner = await loadOwnerBusiness(user.id);
    if (!owner) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (String(owner.role).toLowerCase() !== OWNER_ROLE) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!owner.businessId) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const rows = await prisma.project.findMany({
      where: { businessId: owner.businessId },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { deadline: 'asc' },
    });

    const today = serverToday();
    const isClosed = (p: ProjectRow) =>
      p.status === ProjectStatus.COMPLETED || p.status === ProjectStatus.CANCELLED;

    // Stable sort: undelivered projects first, each group already ordered by deadline asc.
    const sorted = [...rows].sort((a, b) => Number(isClosed(a)) - Number(isClosed(b)));

    const projects = sorted.map((p) => serializeProject(p, today));
    return NextResponse.json({ projects });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
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

  const input = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;

  try {
    const owner = await loadOwnerBusiness(user.id);
    if (!owner) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (String(owner.role).toLowerCase() !== OWNER_ROLE) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!owner.businessId) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name || name.length > 200) {
      return NextResponse.json({ error: 'Enter a project name of up to 200 characters.' }, { status: 400 });
    }

    const clientId = typeof input.clientId === 'string' ? input.clientId : '';
    if (!UUID_RE.test(clientId)) {
      return NextResponse.json({ error: 'Please select a client for this project.' }, { status: 400 });
    }

    const today = serverToday();

    const deadlineRaw = typeof input.deadline === 'string' ? input.deadline : '';
    if (!isValidDay(deadlineRaw) || deadlineRaw < today) {
      return NextResponse.json({ error: 'Please choose a deadline today or later.' }, { status: 400 });
    }

    let startDate: string | null = null;
    if (input.startDate !== undefined && input.startDate !== null && input.startDate !== '') {
      if (typeof input.startDate !== 'string' || !isValidDay(input.startDate)) {
        return NextResponse.json({ error: 'Enter a deadline on or after the project start date.' }, { status: 400 });
      }
      startDate = input.startDate;
      if (deadlineRaw < startDate) {
        return NextResponse.json({ error: 'Enter a deadline on or after the project start date.' }, { status: 400 });
      }
    }

    const rawValue = input.value;
    const value =
      typeof rawValue === 'number'
        ? rawValue
        : typeof rawValue === 'string' && rawValue.trim() !== ''
          ? Number(rawValue)
          : NaN;
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: 'Please enter a project value of 0 or more.' }, { status: 400 });
    }

    const client = await prisma.client.findFirst({
      where: { id: clientId, businessId: owner.businessId },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json({ error: 'Please select a client for this project.' }, { status: 400 });
    }

    const created = await prisma.project.create({
      data: {
        name,
        clientId,
        businessId: owner.businessId,
        userId: user.id,
        status: ProjectStatus.PLANNED,
        deadline: new Date(`${deadlineRaw}T00:00:00Z`),
        startDate: startDate ? new Date(`${startDate}T00:00:00Z`) : null,
        value,
      },
      include: { client: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ project: serializeProject(created, today) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}