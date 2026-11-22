import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const ALLOWED_ROLES = ['freelance_video_editor', 'small_video_editing_business_owner'];
const FREELANCE_ROLE = 'freelance_video_editor';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9 \-()]+$/;

type Caller = { id: string; role: string; businessId: string | null };

type ClientPatch = Prisma.ClientUpdateInput;

async function loadCaller(userId: string): Promise<Caller | null> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, businessId: true },
  });
  if (!dbUser) return null;
  return {
    id: dbUser.id,
    // Prisma returns the enum identifier (FREELANCE_VIDEO_EDITOR); normalise to the stored value.
    role: String(dbUser.role).toLowerCase(),
    businessId: dbUser.businessId,
  };
}

function clientWhere(clientId: string, caller: Caller): Prisma.ClientWhereInput | null {
  if (caller.role === FREELANCE_ROLE) {
    return { id: clientId, userId: caller.id };
  }
  if (!caller.businessId) return null;
  return { id: clientId, businessId: caller.businessId };
}

function toNum(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value.toString());
}

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

async function authorize(request: Request): Promise<{ caller: Caller } | Response> {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const caller = await loadCaller(user.id);
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ALLOWED_ROLES.includes(caller.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return { caller };
}

function parseClientPatch(raw: unknown): { data: ClientPatch } | { error: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { error: 'Request body must be an object' };
  }
  const body = raw as Record<string, unknown>;
  const data: ClientPatch = {};

  if ('name' in body) {
    if (typeof body.name !== 'string' || body.name.trim() === '') {
      return { error: "Please enter the client's name." };
    }
    const name = body.name.trim();
    if (name.length > 120) {
      return { error: 'Client name must be 120 characters or fewer.' };
    }
    data.name = name;
  }

  if ('email' in body) {
    const value = typeof body.email === 'string' ? body.email.trim() : '';
    if (value === '') {
      data.email = null;
    } else if (!EMAIL_RE.test(value)) {
      return { error: 'Please enter a valid email address, for example name@company.com.' };
    } else {
      data.email = value.toLowerCase();
    }
  }

  if ('phone' in body) {
    const value = typeof body.phone === 'string' ? body.phone.trim() : '';
    if (value === '') {
      data.phone = null;
    } else if (value.length > 25 || !PHONE_RE.test(value)) {
      return { error: 'Please enter a valid phone number using digits, spaces, dashes or a leading +.' };
    } else {
      data.phone = value;
    }
  }

  if ('address' in body) {
    const value = typeof body.address === 'string' ? body.address.trim() : '';
    if (value.length > 300) {
      return { error: 'Address must be 300 characters or fewer.' };
    }
    data.address = value === '' ? null : value;
  }

  if ('status' in body) {
    if (body.status === 'active') {
      data.status = 'ACTIVE';
    } else if (body.status === 'inactive') {
      data.status = 'INACTIVE';
    } else {
      return { error: 'Status must be active or inactive.' };
    }
  }

  return { data };
}

export async function GET(request: Request, { params }: { params: { clientId: string } }) {
  const auth = await authorize(request);
  if (auth instanceof Response) return auth;
  const { caller } = auth;

  const where = clientWhere(params.clientId, caller);
  if (!where) return notFound();

  try {
    const client = await prisma.client.findFirst({
      where,
      include: {
        projects: { orderBy: { deadline: 'asc' } },
        invoices: { orderBy: { issueDate: 'desc' } },
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!client) return notFound();

    const { projects, invoices, payments, ...clientFields } = client;

    return NextResponse.json({
      client: clientFields,
      projects: projects.map((p) => ({ ...p, value: toNum(p.value) })),
      invoices: invoices.map((inv) => ({
        ...inv,
        amount: toNum(inv.amount),
        amountPaid: toNum(inv.amountPaid),
        balanceDue: toNum(inv.balanceDue),
      })),
      payments: payments.map((pay) => ({ ...pay, amount: toNum(pay.amount) })),
    });
  } catch (e) {
    console.error('GET /api/clients/[clientId] failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { clientId: string } }) {
  const auth = await authorize(request);
  if (auth instanceof Response) return auth;
  const { caller } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = parseClientPatch(body);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const where = clientWhere(params.clientId, caller);
  if (!where) return notFound();

  try {
    const existing = await prisma.client.findFirst({ where });
    if (!existing) return notFound();

    if (typeof parsed.data.email === 'string') {
      const duplicate = await prisma.client.findFirst({
        where: {
          businessId: existing.businessId,
          email: { equals: parsed.data.email, mode: 'insensitive' },
          NOT: { id: existing.id },
        },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'A client with this email already exists in your business.' },
          { status: 409 },
        );
      }
    }

    const client = await prisma.client.update({
      where: { id: existing.id },
      data: parsed.data,
    });

    return NextResponse.json({ client });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return notFound();
    }
    console.error('PATCH /api/clients/[clientId] failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { clientId: string } }) {
  const auth = await authorize(request);
  if (auth instanceof Response) return auth;
  const { caller } = auth;

  const where = clientWhere(params.clientId, caller);
  if (!where) return notFound();

  try {
    const existing = await prisma.client.findFirst({
      where,
      select: {
        id: true,
        _count: { select: { projects: true, invoices: true } },
      },
    });
    if (!existing) return notFound();

    if (existing._count.projects > 0 || existing._count.invoices > 0) {
      return NextResponse.json(
        { error: 'This client has projects or invoices. Set it to inactive instead.' },
        { status: 409 },
      );
    }

    await prisma.client.delete({ where: { id: existing.id } });

    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return notFound();
    }
    console.error('DELETE /api/clients/[clientId] failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}