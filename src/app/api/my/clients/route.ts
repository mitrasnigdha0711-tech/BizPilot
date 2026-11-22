import { NextResponse } from 'next/server';
import { ClientStatus, InvoiceStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const OUTSTANDING_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s\-()]+$/;

async function loadCaller(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, businessId: true, isActive: true },
  });
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const caller = await loadCaller(user.id);
    if (!caller || !caller.isActive) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (caller.role !== Role.FREELANCE_VIDEO_EDITOR) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await prisma.client.findMany({
      where: { userId: caller.id },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { projects: true } },
        invoices: {
          where: { status: { in: OUTSTANDING_STATUSES } },
          select: { balanceDue: true },
        },
      },
    });

    const clients = rows.map(({ _count, invoices, ...client }) => ({
      ...client,
      projectCount: _count.projects,
      outstandingBalance: invoices.reduce(
        (sum, inv) => sum + Number(inv.balanceDue),
        0,
      ),
    }));

    return NextResponse.json({ clients });
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
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;

  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!name) {
    return NextResponse.json(
      { error: "Please enter the client's name." },
      { status: 400 },
    );
  }
  if (name.length > 120) {
    return NextResponse.json(
      { error: 'Client name must be 120 characters or fewer.' },
      { status: 400 },
    );
  }

  const emailInput =
    typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : '';
  const email = emailInput === '' ? null : emailInput;
  if (email !== null && (email.length > 254 || !EMAIL_RE.test(email))) {
    return NextResponse.json(
      {
        error:
          'Please enter a valid email address, for example name@company.com.',
      },
      { status: 400 },
    );
  }

  const phoneInput = typeof raw.phone === 'string' ? raw.phone.trim() : '';
  const phone = phoneInput === '' ? null : phoneInput;
  if (
    phone !== null &&
    (phone.length > 25 || !PHONE_RE.test(phone))
  ) {
    return NextResponse.json(
      {
        error:
          'Please enter a valid phone number using digits, spaces, dashes or a leading +.',
      },
      { status: 400 },
    );
  }

  const addressInput =
    typeof raw.address === 'string' ? raw.address.trim() : '';
  const address = addressInput === '' ? null : addressInput;
  if (address !== null && address.length > 300) {
    return NextResponse.json(
      { error: 'Address must be 300 characters or fewer.' },
      { status: 400 },
    );
  }

  try {
    const caller = await loadCaller(user.id);
    if (!caller || !caller.isActive) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (caller.role !== Role.FREELANCE_VIDEO_EDITOR) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!caller.businessId) {
      return NextResponse.json(
        { error: 'Set up your business before adding clients.' },
        { status: 409 },
      );
    }

    if (email) {
      const duplicate = await prisma.client.findFirst({
        where: { businessId: caller.businessId, email },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'A client with this email already exists in your business.' },
          { status: 409 },
        );
      }
    }

    const client = await prisma.client.create({
      data: {
        name,
        email,
        phone,
        address,
        status: ClientStatus.ACTIVE,
        businessId: caller.businessId,
        userId: caller.id,
      },
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json(
        { error: 'A client with this email already exists in your business.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}