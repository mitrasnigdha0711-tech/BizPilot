import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUBJECT_MAX = 150;
const BODY_MAX = 5000;

export async function POST(
  request: Request,
  { params }: { params: { reminderId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (String(user.role) !== 'freelance_video_editor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const reminderId = params.reminderId;
  if (!UUID_RE.test(reminderId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const reminder = await prisma.reminder.findFirst({
      where: { id: reminderId, userId: user.id },
      include: { invoice: true, client: true },
    });

    if (!reminder) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (reminder.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only a draft reminder can be approved' },
        { status: 409 },
      );
    }

    const subject = (reminder.subject ?? '').trim();
    const body = (reminder.body ?? '').trim();

    if (!subject) {
      return NextResponse.json(
        { error: 'Please add a subject line for this reminder.' },
        { status: 400 },
      );
    }
    if (subject.length > SUBJECT_MAX) {
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
    if (body.length > BODY_MAX) {
      return NextResponse.json(
        { error: 'Message must be 5000 characters or fewer.' },
        { status: 400 },
      );
    }

    const clientEmail = reminder.client.email?.trim() ?? '';
    if (!clientEmail || !EMAIL_RE.test(clientEmail)) {
      return NextResponse.json(
        { error: 'The client must have a valid email address before this reminder can be approved.' },
        { status: 400 },
      );
    }

    if (Number(reminder.invoice.balanceDue) <= 0) {
      return NextResponse.json(
        { error: 'This invoice has no balance due, so a reminder cannot be approved.' },
        { status: 409 },
      );
    }

    const updated = await prisma.reminder.update({
      where: { id: reminder.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
      },
    });

    return NextResponse.json({ reminder: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}