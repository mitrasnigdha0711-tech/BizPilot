import { NextResponse } from 'next/server';
import { Prisma, ReminderTone } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

type RouteContext = { params: Promise<{ reminderId: string }> };

const SUBJECT_MAX = 150;
const BODY_MAX = 5000;
const TONES = Object.values(ReminderTone) as string[];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Access =
  | { ok: true; where: Prisma.ReminderWhereInput }
  | { ok: false; response: NextResponse };

async function resolveAccess(userId: string): Promise<Access> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, businessId: true },
  });
  if (!dbUser) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (dbUser.role === 'FREELANCE_VIDEO_EDITOR') {
    return { ok: true, where: { userId: dbUser.id } };
  }
  if (dbUser.role === 'SMALL_VIDEO_EDITING_BUSINESS_OWNER') {
    if (!dbUser.businessId) {
      return { ok: false, response: NextResponse.json({ error: 'No business linked to this account' }, { status: 403 }) };
    }
    return { ok: true, where: { invoice: { businessId: dbUser.businessId } } };
  }
  return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
}

function handleWriteError(e: unknown): NextResponse {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}

export async function GET(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const { reminderId } = await params;
  if (!UUID_RE.test(reminderId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const access = await resolveAccess(user.id);
  if (!access.ok) return access.response;

  try {
    const reminder = await prisma.reminder.findFirst({
      where: { id: reminderId, ...access.where },
    });
    if (!reminder) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ reminder });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const { reminderId } = await params;
  if (!UUID_RE.test(reminderId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const input = parsed as Record<string, unknown>;

  const data: Prisma.ReminderUpdateInput = {};

  if ('subject' in input) {
    if (typeof input.subject !== 'string' || input.subject.trim().length === 0) {
      return NextResponse.json({ error: 'Please add a subject line for this reminder.' }, { status: 400 });
    }
    const subject = input.subject.trim();
    if (subject.length > SUBJECT_MAX) {
      return NextResponse.json({ error: 'Subject must be 150 characters or fewer.' }, { status: 400 });
    }
    data.subject = subject;
  }

  if ('body' in input) {
    if (typeof input.body !== 'string' || input.body.trim().length === 0) {
      return NextResponse.json({ error: 'Please write a message body before sending this reminder.' }, { status: 400 });
    }
    if (input.body.length > BODY_MAX) {
      return NextResponse.json({ error: 'Message must be 5000 characters or fewer.' }, { status: 400 });
    }
    data.body = input.body;
  }

  if ('tone' in input) {
    if (typeof input.tone !== 'string' || !TONES.includes(input.tone)) {
      return NextResponse.json({ error: 'Please choose a tone for the reminder.' }, { status: 400 });
    }
    data.tone = input.tone as ReminderTone;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });
  }

  const access = await resolveAccess(user.id);
  if (!access.ok) return access.response;

  try {
    const existing = await prisma.reminder.findFirst({
      where: { id: reminderId, ...access.where },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft reminders can be edited' },
        { status: 409 },
      );
    }

    const reminder = await prisma.reminder.update({
      where: { id: existing.id },
      data: {
        ...data,
        isUserEdited: true,
        editedAt: new Date(),
      },
    });
    return NextResponse.json({ reminder });
  } catch (e) {
    return handleWriteError(e);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const { reminderId } = await params;
  if (!UUID_RE.test(reminderId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const access = await resolveAccess(user.id);
  if (!access.ok) return access.response;

  try {
    const existing = await prisma.reminder.findFirst({
      where: { id: reminderId, ...access.where },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Approved or sent reminders cannot be deleted' },
        { status: 409 },
      );
    }

    await prisma.reminder.delete({ where: { id: existing.id } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return handleWriteError(e);
  }
}