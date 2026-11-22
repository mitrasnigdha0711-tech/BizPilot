import { NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import type { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser, hashPassword } from '@/lib/session';
import { sendEmail } from '@/lib/mailer';

const OWNER_ROLE: Role = 'SMALL_VIDEO_EDITING_BUSINESS_OWNER';

const ROLE_MAP: Record<string, Role> = {
  freelance_video_editor: 'FREELANCE_VIDEO_EDITOR',
  small_video_editing_business_owner: 'SMALL_VIDEO_EDITING_BUSINESS_OWNER',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_WINDOW_MS = 60 * 60 * 1000;

const publicUserSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  email: true,
  name: true,
  role: true,
  businessId: true,
  isActive: true,
  lastLoginAt: true,
} as const;

/**
 * Resolves the signed-in owner and their business.
 * Returns the businessId string on success, or a Response (401/403/409) otherwise.
 */
async function requireOwnerBusiness(request: Request): Promise<string | Response> {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, businessId: true, isActive: true },
  });

  if (!me || !me.isActive) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (me.role !== OWNER_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!me.businessId) {
    return NextResponse.json(
      { error: 'Business setup required before adding team members' },
      { status: 409 },
    );
  }
  return me.businessId;
}

export async function GET(request: Request) {
  const ctx = await requireOwnerBusiness(request);
  if (typeof ctx !== 'string') return ctx;

  try {
    const users = await prisma.user.findMany({
      where: { businessId: ctx },
      orderBy: { createdAt: 'asc' },
      select: publicUserSelect,
    });
    return NextResponse.json({ users });
  } catch (e) {
    console.error('GET /api/admin/users failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const ctx = await requireOwnerBusiness(request);
  if (typeof ctx !== 'string') return ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { email, name, role } = body as Record<string, unknown>;

  if (typeof email !== 'string' || typeof name !== 'string' || typeof role !== 'string') {
    return NextResponse.json(
      { error: 'Missing required fields: email, name, role' },
      { status: 400 },
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
  }
  if (trimmedName.length === 0) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const roleValue = ROLE_MAP[role];
  if (!roleValue) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    // Account is created with an unguessable password; the member sets their own
    // password through the reset flow using the emailed link.
    const passwordHash = await hashPassword(randomBytes(32).toString('hex'));
    const resetToken = randomBytes(32).toString('hex');
    const resetTokenHash = createHash('sha256').update(resetToken).digest('hex');
    const resetExpiresAt = new Date(Date.now() + RESET_WINDOW_MS);

    const created = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: trimmedName,
        role: roleValue,
        businessId: ctx,
        passwordHash,
        isActive: true,
        passwordResetToken: resetToken,
        passwordResetTokenHash: resetTokenHash,
        passwordResetExpiresAt: resetExpiresAt,
      },
      select: publicUserSelect,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const link = `${appUrl}/reset-password?token=${resetToken}`;

    try {
      await sendEmail({
        to: created.email,
        subject: 'You have been invited to BizPilot',
        text: `Hello ${created.name},\n\nYou have been added to a BizPilot business. Set your password using this link (valid for one hour):\n\n${link}\n`,
      });
    } catch (mailErr) {
      console.warn('Set-password email could not be sent for new team member', mailErr);
    }

    return NextResponse.json({ user: created }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }
    console.error('POST /api/admin/users failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}