import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const OWNER_ROLE = 'SMALL_VIDEO_EDITING_BUSINESS_OWNER';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s\-()]+$/;

type OwnerContext = { userId: string; businessId: string };

type ClientInput = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

async function resolveOwner(request: Request): Promise<OwnerContext | Response> {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, businessId: true, isActive: true },
    });

    if (!dbUser || !dbUser.isActive) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (dbUser.role !== OWNER_ROLE) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!dbUser.businessId) {
      return NextResponse.json(
        { error: 'Set up your business before adding clients' },
        { status: 400 },
      );
    }

    return { userId: dbUser.id, businessId: dbUser.businessId };
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function parseClientInput(body: unknown): { data: ClientInput } | { error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: "Please enter the client's name." };
  }

  const raw = body as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';

  if (!name) {
    return { error: "Please enter the client's name." };
  }
  if (name.length > 120) {
    return { error: 'Client name must be 120 characters or fewer.' };
  }

  const emailRaw = optionalText(raw.email);
  const email = emailRaw ? emailRaw.toLowerCase() : null;
  if (email && (email.length > 254 || !EMAIL_RE.test(email))) {
    return { error: 'Please enter a valid email address, for example name@company.com.' };
  }

  const phone = optionalText(raw.phone);
  if (phone && (phone.length > 25 || !PHONE_RE.test(phone) || !/\d/.test(phone))) {
    return {
      error: 'Please enter a valid phone number using digits, spaces, dashes or a leading +.',
    };
  }

  const address = optionalText(raw.address);
  if (address && address.length > 300) {
    return { error: 'Address must be 300 characters or fewer.' };
  }

  return { data: { name, email, phone, address } };
}

export async function GET(request: Request) {
  const owner = await resolveOwner(request);
  if (owner instanceof Response) return owner;

  try {
    const clients = await prisma.client.findMany({
      where: { businessId: owner.businessId },
      include: { _count: { select: { projects: true } } },
      orderBy: { name: 'asc' },
    });

    const balances = await prisma.invoice.groupBy({
      by: ['clientId'],
      where: {
        businessId: owner.businessId,
        status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
        balanceDue: { gt: 0 },
      },
      _sum: { balanceDue: true },
    });

    const balanceByClient = new Map<string, number>(
      balances.map((row) => [row.clientId, Number(row._sum.balanceDue ?? 0)]),
    );

    const payload = clients.map(({ _count, ...client }) => ({
      ...client,
      projectCount: _count.projects,
      outstandingBalance: balanceByClient.get(client.id) ?? 0,
    }));

    return NextResponse.json({ clients: payload });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const owner = await resolveOwner(request);
  if (owner instanceof Response) return owner;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = parseClientInput(body);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    if (parsed.data.email) {
      const duplicate = await prisma.client.findFirst({
        where: {
          businessId: owner.businessId,
          email: { equals: parsed.data.email, mode: 'insensitive' },
        },
        select: { id: true },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: 'A client with this email already exists in your business' },
          { status: 409 },
        );
      }
    }

    const client = await prisma.client.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        address: parsed.data.address,
        businessId: owner.businessId,
        userId: owner.userId,
      },
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json(
        { error: 'A client with this email already exists in your business' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}