import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { sendEmail } from '@/lib/mailer';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
  request: Request,
  { params }: { params: { reminderId: string } }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (dbUser.role !== 'FREELANCE_VIDEO_EDITOR') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const reminderId = params.reminderId;

  try {
    const reminder = await prisma.reminder.findFirst({
      where: { id: reminderId, userId: user.id },
    });
    if (!reminder) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (reminder.status !== 'APPROVED') {
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
    if (subject.length > 150) {
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
    if (body.length > 5000) {
      return NextResponse.json(
        { error: 'Message must be 5000 characters or fewer.' },
        { status: 400 }
      );
    }

    const client = await prisma.client.findFirst({
      where: { id: reminder.clientId, userId: user.id },
      select: { email: true },
    });
    const recipient = client?.email?.trim() ?? '';
    if (!recipient || !EMAIL_PATTERN.test(recipient)) {
      return NextResponse.json(
        { error: 'The client does not have a valid email address on record.' },
        { status: 400 }
      );
    }

    try {
      await sendEmail({
        to: recipient,
        subject,
        text: body,
      });
    } catch (mailError) {
      console.error('Failed to send reminder email', mailError);
      return NextResponse.json(
        { error: 'Internal error' },
        { status: 500 }
      );
    }

    const sent = await prisma.reminder.update({
      where: { id: reminder.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    return NextResponse.json({ reminder: sent });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}