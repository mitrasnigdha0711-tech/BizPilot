import { NextResponse } from 'next/server';
import { Prisma, ReminderStatus, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUBJECT_MAX_LENGTH = 150;
const BODY_MAX_LENGTH = 5000;

type OwnerContext = { businessId: string } | { response: Response };

async function resolveOwnerContext(request: Request): Promise<OwnerContext> {
  const user = await requireUser(request);
  if (user instanceof Response) return { response: user };

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, businessId: true },
  });
  if (!row) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (row.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  if (!row.businessId) {
    return { response: NextResponse.json({ error: 'No business linked to this account' }, { status: 403 }) };
  }
  return { businessId: row.businessId };
}

function isOwnerContextError(ctx: OwnerContext): ctx is { response: Response } {
  return 'response' in ctx;
}

export async function PATCH(
  request: Request,
  { params }: { params: { reminderId: string } }
) {
  const ctx = await resolveOwnerContext(request);
  if (isOwnerContextError(ctx)) return ctx.response;

  const reminderId = params.reminderId;
  if (!UUID_PATTERN.test(reminderId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const input = raw as Record<string, unknown>;
  const data: { subject?: string; body?: string } = {};

  if ('subject' in input) {
    if (typeof input.subject !== 'string' || input.subject.trim() === '') {
      return NextResponse.json(
        { error: 'Please add a subject line for this reminder.' },
        { status: 400 }
      );
    }
    const subject = input.subject.trim();
    if (subject.length > SUBJECT_MAX_LENGTH) {
      return NextResponse.json(
        { error: 'Subject must be 150 characters or fewer.' },
        { status: 400 }
      );
    }
    data.subject = subject;
  }

  if ('body' in input) {
    if (typeof input.body !== 'string' || input.body.trim() === '') {
      return NextResponse.json(
        { error: 'Please write a message body before sending this reminder.' },
        { status: 400 }
      );
    }
    if (input.body.length > BODY_MAX_LENGTH) {
      return NextResponse.json(
        { error: 'Message must be 5000 characters or fewer.' },
        { status: 400 }
      );
    }
    data.body = input.body;
  }

  if (data.subject === undefined && data.body === undefined) {
    return NextResponse.json(
      { error: 'Provide a subject or body to update' },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.reminder.findFirst({
      where: { id: reminderId, invoice: { businessId: ctx.businessId } },
      select: { id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (existing.status === ReminderStatus.SENT) {
      return NextResponse.json(
        { error: 'Sent reminders can no longer be edited' },
        { status: 409 }
      );
    }

    const reminder = await prisma.reminder.update({
      where: { id: reminderId },
      data: {
        ...data,
        isUserEdited: true,
        editedAt: new Date(),
      },
    });
    return NextResponse.json({ reminder });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { reminderId: string } }
) {
  const ctx = await resolveOwnerContext(request);
  if (isOwnerContextError(ctx)) return ctx.response;

  const reminderId = params.reminderId;
  if (!UUID_PATTERN.test(reminderId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const existing = await prisma.reminder.findFirst({
      where: { id: reminderId, invoice: { businessId: ctx.businessId } },
      select: { id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (existing.status === ReminderStatus.SENT) {
      return NextResponse.json(
        { error: 'Sent reminders cannot be deleted' },
        { status: 409 }
      );
    }

    await prisma.reminder.delete({ where: { id: reminderId } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}