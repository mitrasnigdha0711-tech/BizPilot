import { NextRequest, NextResponse } from 'next/server';
import { Prisma, ReminderStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { sendEmail } from '@/lib/mailer';

const ALLOWED_ROLES: string[] = [
  'freelance_video_editor',
  'small_video_editing_business_owner',
];
const OWNER_ROLE = 'small_video_editing_business_owner';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBJECT_MAX = 150;
const BODY_MAX = 5000;

export async function POST(
  request: NextRequest,
  { params }: { params: { reminderId: string } }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const role: string = user.role;
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { reminderId } = params;

  try {
    const reminder = await prisma.reminder.findUnique({
      where: { id: reminderId },
      include: { invoice: true, client: true },
    });

    if (!reminder) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Scope: owners may send any reminder in their business; freelancers only their own.
    if (role === OWNER_ROLE) {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { businessId: true },
      });
      if (!dbUser?.businessId || reminder.invoice.businessId !== dbUser.businessId) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    } else if (reminder.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (reminder.status === ReminderStatus.SENT) {
      return NextResponse.json(
        { error: 'This reminder has already been sent.' },
        { status: 409 }
      );
    }

    if (reminder.status !== ReminderStatus.APPROVED) {
      return NextResponse.json(
        { error: 'Only an approved reminder can be sent.' },
        { status: 409 }
      );
    }

    const subject = (reminder.subject ?? '').trim();
    const body = (reminder.body ?? '').trim();

    if (!subject) {
      return NextResponse.json(
        { error: 'Please add a subject line for this reminder.' },
        { status: 400 }
      );
    }
    if (subject.length > SUBJECT_MAX) {
      return NextResponse.json(
        { error: 'Subject must be 150 characters or fewer.' },
        { status: 400 }
      );
    }
    if (!body) {
      return NextResponse.json(
        { error: 'Please write a message body before sending this reminder.' },
        { status: 400 }
      );
    }
    if (body.length > BODY_MAX) {
      return NextResponse.json(
        { error: 'Message must be 5000 characters or fewer.' },
        { status: 400 }
      );
    }

    const recipient = reminder.client?.email?.trim() ?? '';
    if (!recipient || !EMAIL_RE.test(recipient)) {
      return NextResponse.json(
        { error: 'The client has no valid email address on record.' },
        { status: 422 }
      );
    }

    // Send only the stored, approved text.
    try {
      await sendEmail({ to: recipient, subject, text: body });
    } catch {
      return NextResponse.json(
        { error: 'Could not deliver the reminder email.' },
        { status: 502 }
      );
    }

    // Guard against a concurrent send: only transition if still approved.
    const transition = await prisma.reminder.updateMany({
      where: { id: reminderId, status: ReminderStatus.APPROVED },
      data: { status: ReminderStatus.SENT, sentAt: new Date() },
    });

    if (transition.count === 0) {
      return NextResponse.json(
        { error: 'This reminder was changed before it could be marked sent.' },
        { status: 409 }
      );
    }

    const sent = await prisma.reminder.findUnique({ where: { id: reminderId } });
    return NextResponse.json({ reminder: sent });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}