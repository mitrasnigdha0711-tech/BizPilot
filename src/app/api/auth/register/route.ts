import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, sessionResponse } from '@/lib/session';

// Rendered by the pipeline: creates an account and signs it in.
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'The password must be at least 8 characters.' }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { email: email }, omit: { passwordHash: false } });
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
  }
  const user = await prisma.user.create({ data: { email: email, passwordHash: await hashPassword(password), name: name || email.split('@')[0] } });
  const safe: Record<string, unknown> = { ...user };
  delete safe.passwordHash;
  delete safe.tokenVersion;
  return sessionResponse({ user: safe }, { id: String(user.id), email: user.email, role: user.role ? String(user.role) : null }, { status: 201 });
}
