import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(
  request: Request,
  { params }: { params: { reminderId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, businessId: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isOwner = dbUser.role === 'SMALL_VIDEO_EDITING_BUSINESS_OWNER';
    const isEditor = dbUser.role === 'FREELANCE_VIDEO_EDITOR';
    if (!isOwner && !isEditor) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const reminder = await prisma.reminder.findUnique({
      where: { id: params.reminderId },
      include: { invoice: true, client: true },
    });
    if (!reminder) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Owners may approve any reminder in their business; freelancers only their own.
    const visible = isOwner
      ? dbUser.businessId !== null && reminder.invoice.businessId === dbUser.businessId
      : reminder.userId === dbUser.id;
    if (!visible) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (reminder.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only a draft reminder can be approved' },
        { status: 409 },
      );
    }

    const subject = reminder.subject ?? '';
    const body = reminder.body ?? '';

    if (subject.trim().length === 0) {
      return NextResponse.json(
        { error: 'Please add a subject line for this reminder.' },
        { status: 422 },
      );
    }
    if (subject.length > 150) {
      return NextResponse.json(
        { error: 'Subject must be 150 characters or fewer.' },
        { status: 422 },
      );
    }
    if (body.trim().length === 0) {
      return NextResponse.json(
        { error: 'Please write a message body before sending this reminder.' },
        { status: 422 },
      );
    }
    if (body.length > 5000) {
      return NextResponse.json(
        { error: 'Message must be 5000 characters or fewer.' },
        { status: 422 },
      );
    }

    if (Number(reminder.invoice.balanceDue) <= 0) {
      return NextResponse.json(
        { error: 'This invoice has no balance due, so a reminder cannot be approved.' },
        { status: 409 },
      );
    }

    const email = reminder.client.email?.trim() ?? '';
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: 'The recipient client needs a valid email address before this reminder can be approved.' },
        { status: 422 },
      );
    }

    // Conditional update so a concurrent approval cannot move the draft twice.
    const result = await prisma.reminder.updateMany({
      where: { id: reminder.id, status: 'DRAFT' },
      data: { status: 'APPROVED', approvedAt: new Date() },
    });
    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Only a draft reminder can be approved' },
        { status: 409 },
      );
    }

    const approved = await prisma.reminder.findUnique({
      where: { id: reminder.id },
    });

    return NextResponse.json({ reminder: approved });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}