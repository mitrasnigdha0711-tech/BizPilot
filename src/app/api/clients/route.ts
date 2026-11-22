import { NextResponse } from 'next/server';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s()-]+$/;

const ALLOWED_ROLES: Role[] = [
  Role.FREELANCE_VIDEO_EDITOR,
  Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER,
];

type ClientInput = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  address?: unknown;
};

function optionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validate(input: ClientInput): { error: string } | null {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    return { error: "Please enter the client's name." };
  }
  if (name.length > 120) {
    return { error: 'Client name must be 120 characters or fewer.' };
  }

  const email = optionalString(input.email);
  if (email !== null && !EMAIL_RE.test(email)) {
    return {
      error: 'Please enter a valid email address, for example name@company.com.',
    };
  }

  const phone = optionalString(input.phone);
  if (phone !== null) {
    if (phone.length > 25 || !PHONE_RE.test(phone) || !/\d/.test(phone)) {
      return {
        error: 'Please enter a valid phone number using digits, spaces, dashes or a leading +.',
      };
    }
  }

  const address = optionalString(input.address);
  if (address !== null && address.length > 300) {
    return { error: 'Address must be 300 characters or fewer.' };
  }

  return null;
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const input = raw as ClientInput;

  const invalid = validate(input);
  if (invalid) {
    return NextResponse.json(invalid, { status: 400 });
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, businessId: true, isActive: true },
    });

    if (!dbUser || !dbUser.isActive) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ALLOWED_ROLES.includes(dbUser.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!dbUser.businessId) {
      return NextResponse.json(
        { error: 'Set up your business before adding clients.' },
        { status: 400 },
      );
    }

    const name = (input.name as string).trim();
    const email = optionalString(input.email)?.toLowerCase() ?? null;
    const phone = optionalString(input.phone);
    const address = optionalString(input.address);

    if (email !== null) {
      const duplicate = await prisma.client.findFirst({
        where: {
          businessId: dbUser.businessId,
          email: { equals: email, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'A client with this email address already exists in your business.' },
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
        status: 'ACTIVE',
        businessId: dbUser.businessId,
        userId: dbUser.id,
      },
    });

    return NextResponse.json({ client }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}