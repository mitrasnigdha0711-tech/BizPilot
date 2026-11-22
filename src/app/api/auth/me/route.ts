import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const profileSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  businessId: true,
  isActive: true,
  lastLoginAt: true,
  passwordChangedAt: true,
  createdAt: true,
  updatedAt: true,
  business: {
    select: {
      id: true,
      name: true,
      currency: true,
    },
  },
} satisfies Prisma.UserSelect;

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: profileSelect,
    });

    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ user: row });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be an object' }, { status: 400 });
  }

  const { name, email } = body as { name?: unknown; email?: unknown };
  const data: Prisma.UserUpdateInput = {};

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name must be a non-empty string' }, { status: 400 });
    }
    data.name = name.trim();
  }

  let normalizedEmail: string | undefined;
  if (email !== undefined) {
    if (typeof email !== 'string') {
      return NextResponse.json({ error: 'Email must be a string' }, { status: 400 });
    }
    normalizedEmail = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }
    data.email = normalizedEmail;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
  }

  try {
    if (normalizedEmail !== undefined) {
      const taken = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (taken && taken.id !== user.id) {
        return NextResponse.json({ error: 'Email is already in use' }, { status: 409 });
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
      select: profileSelect,
    });

    return NextResponse.json({ user: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      if (e.code === 'P2002') {
        return NextResponse.json({ error: 'Email is already in use' }, { status: 409 });
      }
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}