import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/mailer';

const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL_MS = 60 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX_REQUESTS = 3;
const CONFIRMATION_MESSAGE =
  'If an account exists for that email, a password reset link has been sent.';

// Per-email request timestamps. Only used for rate limiting, never for sessions.
const requestLog = new Map<string, number[]>();

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(email) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX_REQUESTS) {
    requestLog.set(email, recent);
    return true;
  }
  recent.push(now);
  requestLog.set(email, recent);
  return false;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const rawEmail =
    typeof body === 'object' && body !== null && 'email' in body
      ? (body as { email: unknown }).email
      : undefined;

  if (typeof rawEmail !== 'string' || rawEmail.trim() === '') {
    return NextResponse.json(
      { error: 'Please enter your email address.' },
      { status: 400 },
    );
  }

  const email = rawEmail.trim().toLowerCase();

  if (email.length > EMAIL_MAX_LENGTH) {
    return NextResponse.json(
      { error: 'Email address must be 254 characters or fewer.' },
      { status: 400 },
    );
  }

  if (!EMAIL_PATTERN.test(email)) {
    return NextResponse.json(
      { error: 'Please enter a valid email address, such as name@example.com.' },
      { status: 400 },
    );
  }

  if (isRateLimited(email)) {
    return NextResponse.json(
      { error: 'Too many reset requests. Please try again in 15 minutes.' },
      { status: 429 },
    );
  }

  let devLink: string | undefined;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (user && user.isActive) {
      const token = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(token).digest('hex');

      // Replaces any earlier token, so only the most recently emailed link works.
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: null,
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: new Date(Date.now() + TOKEN_TTL_MS),
        },
      });

      const mail = await sendEmail({
        to: email,
        subject: 'Reset your password',
        text:
          'We received a request to reset your BizPilot password. Open the link below to choose a new one. ' +
          'The link expires in one hour. If you did not ask for this, you can ignore this email.',
        link: `/reset-password?token=${token}`,
      });

      devLink = mail.devLink;
    }
  } catch (error) {
    console.error('forgot-password failed', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    emailConfigured: false,
    message: CONFIRMATION_MESSAGE,
    ...(devLink ? { devLink } : {}),
  });
}