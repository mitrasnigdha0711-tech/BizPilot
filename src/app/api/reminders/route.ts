import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { Prisma, Role, ReminderTone, ReminderStatus, InvoiceStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const TONES = ['friendly', 'firm', 'final'] as const;
type Tone = (typeof TONES)[number];
const SUBJECT_MAX = 150;
const BODY_MAX = 5000;
const DAY_MS = 86_400_000;

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayStart(key: string): number {
  return Date.parse(`${key}T00:00:00Z`);
}

function toWire(r: {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  invoiceId: string;
  clientId: string;
  subject: string;
  body: string;
  tone: ReminderTone;
  status: ReminderStatus;
  isUserEdited: boolean;
  editedAt: Date | null;
  approvedAt: Date | null;
  sentAt: Date | null;
  userId: string;
}) {
  return {
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    invoiceId: r.invoiceId,
    clientId: r.clientId,
    subject: r.subject,
    body: r.body,
    tone: String(r.tone).toLowerCase(),
    status: String(r.status).toLowerCase(),
    isUserEdited: r.isUserEdited,
    editedAt: r.editedAt ? r.editedAt.toISOString() : null,
    approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
    sentAt: r.sentAt ? r.sentAt.toISOString() : null,
    userId: r.userId,
  };
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, role: true, businessId: true, isActive: true },
  });
  if (!dbUser || !dbUser.isActive) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (dbUser.role !== Role.FREELANCE_VIDEO_EDITOR && dbUser.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const input = (raw ?? {}) as { invoice_id?: unknown; tone?: unknown };

  if (typeof input.invoice_id !== 'string' || input.invoice_id.trim() === '') {
    return NextResponse.json({ error: 'Missing required field: invoice_id' }, { status: 400 });
  }
  const invoiceId = input.invoice_id.trim();

  if (typeof input.tone !== 'string' || !(TONES as readonly string[]).includes(input.tone)) {
    return NextResponse.json({ error: 'Please choose a tone for the reminder.' }, { status: 400 });
  }
  const tone = input.tone as Tone;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('ANTHROPIC_API_KEY is not set; reminder drafting is unavailable.');
    return NextResponse.json({ error: 'Anthropic is not configured' }, { status: 503 });
  }

  try {
    const invoiceWhere: Prisma.InvoiceWhereInput =
      dbUser.role === Role.FREELANCE_VIDEO_EDITOR
        ? { id: invoiceId, userId: dbUser.id }
        : { id: invoiceId, businessId: dbUser.businessId ?? undefined };
    if (dbUser.role === Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER && !dbUser.businessId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const invoice = await prisma.invoice.findFirst({
      where: invoiceWhere,
      include: { client: { select: { id: true, name: true } } },
    });
    if (!invoice) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (invoice.status === InvoiceStatus.PAID) {
      return NextResponse.json({ error: 'This invoice is already paid.' }, { status: 400 });
    }

    const paidAgg = await prisma.payment.aggregate({
      where: { invoiceId: invoice.id },
      _sum: { amount: true },
    });
    const paid = paidAgg._sum.amount ?? new Prisma.Decimal(0);
    const remaining = invoice.amount.minus(paid);

    if (remaining.lte(0)) {
      return NextResponse.json({ error: 'This invoice has no balance due.' }, { status: 400 });
    }

    const dueKey = invoice.dueDate.toISOString().slice(0, 10);
    const todayKey = localDayKey(new Date());
    const daysOverdue = Math.floor((dayStart(todayKey) - dayStart(dueKey)) / DAY_MS);
    if (daysOverdue <= 0) {
      return NextResponse.json(
        { error: 'Reminders can only be drafted for overdue invoices.' },
        { status: 400 },
      );
    }

    const balance = remaining.toFixed(2);
    let subject: string;
    let body: string;
    try {
      const client = new Anthropic({ apiKey, timeout: 20_000, maxRetries: 1 });
      const message = await client.messages.create({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 800,
        system:
          'You write payment reminder emails for a freelance video editor. Reply with only a JSON object with keys "subject" and "body". Keep the tone as requested. Do not invent details.',
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              tone,
              clientName: invoice.client.name,
              invoiceReference: invoice.invoiceNumber,
              remainingBalance: balance,
              dueDate: dueKey,
              daysOverdue,
            }),
          },
        ],
      });
      const text = message.content
        .map((c) => (c.type === 'text' ? c.text : ''))
        .join('');
      const match = text.match(/\{[\s\S]*\}/);
      const parsed = match ? (JSON.parse(match[0]) as { subject?: unknown; body?: unknown }) : null;
      if (!parsed || typeof parsed.subject !== 'string' || typeof parsed.body !== 'string') {
        throw new Error('Malformed AI response');
      }
      subject = parsed.subject.trim().slice(0, SUBJECT_MAX);
      body = parsed.body.trim().slice(0, BODY_MAX);
      if (!subject || !body) throw new Error('Empty AI draft');
    } catch (err) {
      console.error('Reminder drafting failed:', err);
      return NextResponse.json(
        { error: 'Could not draft the reminder. Please try again.' },
        { status: 502 },
      );
    }

    const reminder = await prisma.reminder.create({
      data: {
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        subject,
        body,
        tone: tone.toUpperCase() as ReminderTone,
        status: ReminderStatus.DRAFT,
        userId: dbUser.id,
      },
    });

    return NextResponse.json({ reminder: toWire(reminder) }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('POST /api/reminders failed:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}