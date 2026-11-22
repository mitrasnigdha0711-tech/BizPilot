import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { Prisma, type ReminderTone } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const TONE_MAP: Record<string, ReminderTone> = {
  friendly: 'FRIENDLY',
  firm: 'FIRM',
  final: 'FINAL',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function POST(
  request: Request,
  { params }: { params: { invoiceId: string } }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const requestedTone =
    body && typeof body === 'object' && 'tone' in body
      ? (body as { tone?: unknown }).tone
      : undefined;
  const toneKey = typeof requestedTone === 'string' ? requestedTone.toLowerCase() : 'friendly';
  const tone = TONE_MAP[toneKey];
  if (!tone) {
    return NextResponse.json(
      { error: 'Please choose a tone for the reminder.' },
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('ANTHROPIC_API_KEY is not set; skipping reminder drafting');
    return NextResponse.json({ error: 'Anthropic is not configured' }, { status: 503 });
  }

  const invoiceId = params.invoiceId;
  if (!UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, businessId: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: { select: { id: true, name: true } },
        payments: { select: { amount: true } },
      },
    });

    const isOwner = dbUser.role === 'SMALL_VIDEO_EDITING_BUSINESS_OWNER';
    const allowed = invoice
      ? isOwner
        ? invoice.businessId === dbUser.businessId
        : invoice.userId === user.id
      : false;
    if (!invoice || !allowed) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const business = await prisma.business.findUnique({
      where: { id: invoice.businessId },
      select: { currency: true },
    });

    const paidTotal = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const balance = roundMoney(Number(invoice.amount) - paidTotal);

    if (invoice.status === 'DRAFT') {
      return NextResponse.json({ error: 'Invoice has not been sent yet' }, { status: 409 });
    }
    if (invoice.status === 'PAID' || balance <= 0) {
      return NextResponse.json({ error: 'Invoice has no balance due' }, { status: 409 });
    }

    const url = new URL(request.url);
    const dayParam = url.searchParams.get('date');
    const today =
      dayParam && DAY_RE.test(dayParam) ? dayParam : new Date().toLocaleDateString('en-CA');
    const dueDay = invoice.dueDate.toISOString().slice(0, 10);
    const isPastDue = dueDay < today;
    if (!isPastDue && invoice.status !== 'OVERDUE') {
      return NextResponse.json({ error: 'Invoice is not overdue' }, { status: 409 });
    }

    const currency = business?.currency ?? '';
    const prompt = [
      `Write a payment reminder email for a client about an overdue invoice.`,
      `Tone: ${toneKey}.`,
      `Client name: ${invoice.client.name}.`,
      `Invoice number: ${invoice.invoiceNumber}.`,
      `Amount still due: ${balance.toFixed(2)} ${currency}.`,
      `Due date: ${dueDay}.`,
      `Keep the subject under 150 characters and the body under 5000 characters.`,
      `Respond with only a JSON object: {"subject": string, "body": string}.`,
    ].join('\n');

    let subject: string;
    let text: string;
    try {
      const client = new Anthropic({ apiKey, timeout: 20000 });
      const message = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      });
      const raw = message.content
        .map((b) => (b.type === 'text' ? b.text : ''))
        .join('');
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      const parsed = JSON.parse(raw.slice(start, end + 1)) as {
        subject?: unknown;
        body?: unknown;
      };
      if (typeof parsed.subject !== 'string' || typeof parsed.body !== 'string') {
        throw new Error('Malformed draft');
      }
      subject = parsed.subject.trim().slice(0, 150);
      text = parsed.body.trim().slice(0, 5000);
    } catch (err) {
      console.error('Anthropic reminder draft failed', err);
      return NextResponse.json({ error: 'Reminder draft failed' }, { status: 502 });
    }

    const reminder = await prisma.reminder.create({
      data: {
        invoiceId: invoice.id,
        clientId: invoice.clientId,
        subject,
        body: text,
        tone,
        status: 'DRAFT',
        userId: user.id,
      },
    });

    return NextResponse.json({ reminder }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}