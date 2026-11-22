import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/session';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const fields = (typeof body === 'object' && body !== null ? body : {}) as {
    token?: unknown;
    password?: unknown;
  };

  if (typeof fields.token !== 'string' || fields.token.trim() === '') {
    return NextResponse.json({ error: 'Reset token is required.' }, { status: 400 });
  }
  if (
    typeof fields.password !== 'string' ||
    fields.password.length < 8 ||
    fields.password.length > 128
  ) {
    return NextResponse.json(
      { error: 'Password must be between 8 and 128 characters.' },
      { status: 400 },
    );
  }

  const rawToken = fields.token.trim();
  const password = fields.password;
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ passwordResetToken: rawToken }, { passwordResetTokenHash: tokenHash }],
      },
    });

    if (
      !user ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() <= Date.now()
    ) {
      return NextResponse.json(
        { error: 'This reset link is invalid or has expired.' },
        { status: 400 },
      );
    }

    const isSameAsCurrent = await verifyPassword(password, user.passwordHash);
    if (isSameAsCurrent) {
      return NextResponse.json(
        { error: 'New password must be different from your current password.' },
        { status: 400 },
      );
    }

    const newHash = await hashPassword(password);
    const now = new Date();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        passwordChangedAt: now,
        passwordResetToken: null,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        sessionToken: null,
        signedOutAt: now,
        tokenVersion: { increment: 1 },
      },
    });

    return NextResponse.json({ reset: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json(
        { error: 'This reset link is invalid or has expired.' },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}