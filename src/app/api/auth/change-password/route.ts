
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser, hashPassword, verifyPassword } from '@/lib/session';

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const fields = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const currentPassword = fields.current_password;
  const newPassword = fields.new_password;

  if (typeof currentPassword !== 'string' || currentPassword.length === 0) {
    return NextResponse.json({ error: 'Current password is required' }, { status: 400 });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
    return NextResponse.json(
      { error: 'Password must be between 8 and 128 characters.' },
      { status: 400 },
    );
  }
  if (newPassword === currentPassword) {
    return NextResponse.json(
      { error: 'New password must differ from your current password.' },
      { status: 400 },
    );
  }

  try {
    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, passwordHash: true },
    });
    if (!record) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const currentOk = await verifyPassword(currentPassword, record.passwordHash);
    if (!currentOk) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);
    const now = new Date();

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: now },
    });

    return NextResponse.json({
      changed: true,
      password_changed_at: now.toISOString(),
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}