import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { sendEmail } from '@/lib/mailer';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SUBJECT = 150;
const MAX_BODY = 5000;

export async function POST(
  request: Request,
  { params }: { params: { reminderId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, businessId: true },
    });

    if (!me || me.role !== 'SMALL_VIDEO_EDITING_BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!me.businessId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const reminder = await prisma.reminder.findFirst({
      where: {
        id: params.reminderId,
        invoice: { businessId: me.businessId },
      },
      include: { client: true, invoice: true },
    });

    if (!reminder) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (reminder.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Only an approved reminder can be sent' },
        { status: 409 },
      );
    }

    const subject = reminder.subject?.trim() ?? '';
    const body = reminder.body?.trim() ?? '';

    if (!subject) {
      return NextResponse.json(
        { error: 'Please add a subject line for this reminder.' },
        { status: 400 },
      );
    }
    if (subject.length > MAX_SUBJECT) {
      return NextResponse.json(
        { error: 'Subject must be 150 characters or fewer.' },
        { status: 400 },
      );
    }
    if (!body) {
      return NextResponse.json(
        { error: 'Please write a message body before sending this reminder.' },
        { status: 400 },
      );
    }
    if (body.length > MAX_BODY) {
      return NextResponse.json(
        { error: 'Message must be 5000 characters or fewer.' },
        { status: 400 },
      );
    }

    const recipient = reminder.client?.email?.trim() ?? '';
    if (!recipient || !EMAIL_RE.test(recipient)) {
      return NextResponse.json(
        { error: 'The client has no valid email address on record.' },
        { status: 400 },
      );
    }

    try {
      await sendEmail({
        to: recipient,
        subject,
        text: body,
      });
    } catch (mailErr) {
      console.error('Failed to send reminder email', mailErr);
      return NextResponse.json(
        { error: 'Email delivery failed' },
        { status: 502 },
      );
    }

    const sent = await prisma.reminder.updateMany({
      where: { id: reminder.id, status: 'APPROVED' },
      data: { status: 'SENT', sentAt: new Date() },
    });

    if (sent.count === 0) {
      return NextResponse.json(
        { error: 'Reminder was already sent or is no longer approved' },
        { status: 409 },
      );
    }

    const updated = await prisma.reminder.findUnique({
      where: { id: reminder.id },
    });

    return NextResponse.json({ reminder: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}