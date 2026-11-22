import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const SUBJECT_MAX = 150;
const BODY_MAX = 5000;

type RouteContext = { params: { reminderId: string } };

function isFreelanceEditor(role: unknown): boolean {
  return typeof role === 'string' && role.toLowerCase() === 'freelance_video_editor';
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (!isFreelanceEditor((user as { role?: unknown }).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const input = (raw ?? {}) as { subject?: unknown; body?: unknown };
  const data: { subject?: string; body?: string } = {};

  if (input.subject !== undefined) {
    if (typeof input.subject !== 'string' || input.subject.trim().length === 0) {
      return NextResponse.json(
        { error: 'Please add a subject line for this reminder.' },
        { status: 400 },
      );
    }
    const subject = input.subject.trim();
    if (subject.length > SUBJECT_MAX) {
      return NextResponse.json(
        { error: `Subject must be ${SUBJECT_MAX} characters or fewer.` },
        { status: 400 },
      );
    }
    data.subject = subject;
  }

  if (input.body !== undefined) {
    if (typeof input.body !== 'string' || input.body.trim().length === 0) {
      return NextResponse.json(
        { error: 'Please write a message body before sending this reminder.' },
        { status: 400 },
      );
    }
    const body = input.body.trim();
    if (body.length > BODY_MAX) {
      return NextResponse.json(
        { error: `Message must be ${BODY_MAX} characters or fewer.` },
        { status: 400 },
      );
    }
    data.body = body;
  }

  if (data.subject === undefined && data.body === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  try {
    const reminder = await prisma.reminder.findFirst({
      where: { id: params.reminderId, userId: user.id },
    });
    if (!reminder) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (reminder.status === 'SENT') {
      return NextResponse.json(
        { error: 'Sent reminders cannot be edited.' },
        { status: 409 },
      );
    }

    const updated = await prisma.reminder.update({
      where: { id: reminder.id },
      data: {
        ...data,
        isUserEdited: true,
        editedAt: new Date(),
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

export async function DELETE(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (!isFreelanceEditor((user as { role?: unknown }).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const reminder = await prisma.reminder.findFirst({
      where: { id: params.reminderId, userId: user.id },
    });
    if (!reminder) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (reminder.status === 'SENT') {
      return NextResponse.json(
        { error: 'Sent reminders cannot be deleted.' },
        { status: 409 },
      );
    }

    await prisma.reminder.delete({ where: { id: reminder.id } });

    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}