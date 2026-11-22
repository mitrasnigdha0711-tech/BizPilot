import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const ALLOWED_ROLES = ['freelance_video_editor', 'small_video_editing_business_owner'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MODEL = 'claude-sonnet-4-5';

function localToday(): string {
  return new Date().toLocaleDateString('en-CA');
}

function parseDay(raw: string | null): string | null {
  if (raw === null) return localToday();
  if (!DAY_RE.test(raw)) return null;
  if (Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) return null;
  return raw;
}

function monthRange(day: string): { start: Date; end: Date } {
  const [y, m] = day.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

function extractJson(raw: string): { text?: string; author?: string; personalSuggestion?: string; challenge?: string } | null {
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first === -1 || last === -1 || last < first) return null;
  try {
    return JSON.parse(raw.slice(first, last + 1));
  } catch {
    return null;
  }
}

async function getOrCreateTodayQuote(request: Request) {
  const session = await requireUser(request);
  if (session instanceof Response) return session;

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, businessId: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const roleValue = String(user.role).toLowerCase();
  if (!ALLOWED_ROLES.includes(roleValue)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const day = parseDay(url.searchParams.get('date'));
  if (!day) {
    return NextResponse.json({ error: 'Invalid date, expected YYYY-MM-DD' }, { status: 400 });
  }

  if (!user.businessId) {
    return NextResponse.json({ error: 'Business setup required' }, { status: 400 });
  }

  const displayDate = new Date(`${day}T00:00:00Z`);

  try {
    const existing = await prisma.quote.findFirst({
      where: { userId: user.id, displayDate },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return NextResponse.json({ quote: existing });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('ANTHROPIC_API_KEY is not set; cannot generate today\'s quote');
      return NextResponse.json({ error: 'Anthropic is not configured' }, { status: 503 });
    }

    const business = await prisma.business.findUnique({
      where: { id: user.businessId },
      select: { name: true, monthlyProjectTarget: true },
    });
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const { start, end } = monthRange(day);
    const [completedThisMonth, activeProjects, openTasks] = await Promise.all([
      prisma.project.count({
        where: {
          userId: user.id,
          status: 'COMPLETED',
          completedAt: { gte: start, lt: end },
        },
      }),
      prisma.project.count({
        where: { userId: user.id, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
      }),
      prisma.task.count({
        where: { userId: user.id, status: 'OPEN' },
      }),
    ]);

    const target = business.monthlyProjectTarget ?? 0;
    const progressPercent = target > 0 ? Math.round((completedThisMonth / target) * 100) : 0;

    const prompt = [
      'Write today\'s motivational quote for a freelance video editor, plus a personal suggestion and one small daily challenge.',
      `Business name: ${business.name}.`,
      `Monthly project target: ${target}. Completed this month: ${completedThisMonth} (${progressPercent}% of target).`,
      `Active projects: ${activeProjects}. Open tasks: ${openTasks}.`,
      'Respond with ONLY a JSON object with keys: "text" (the quote), "author" (string or null), "personalSuggestion" (one or two sentences), "challenge" (one concrete action for today).',
    ].join('\n');

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const block = message.content.find((b) => b.type === 'text');
    const raw = block && block.type === 'text' ? block.text : '';
    const parsed = extractJson(raw);
    if (!parsed || !parsed.text) {
      return NextResponse.json({ error: 'AI generation failed' }, { status: 502 });
    }

    const quote = await prisma.quote.create({
      data: {
        text: parsed.text,
        author: parsed.author ?? null,
        personalSuggestion: parsed.personalSuggestion ?? null,
        challengeText: parsed.challenge ?? null,
        challengeStatus: parsed.challenge ? 'pending' : null,
        displayDate,
        isFavourite: false,
        businessId: user.businessId,
        userId: user.id,
      },
    });

    return NextResponse.json({ quote });
  } catch (e) {
    console.error('GET/POST /api/my/quotes/today failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return getOrCreateTodayQuote(request);
}

export async function POST(request: Request) {
  return getOrCreateTodayQuote(request);
}