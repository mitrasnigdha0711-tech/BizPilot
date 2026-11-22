import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const OWNER_ROLE = 'small_video_editing_business_owner';
const MODEL = 'claude-sonnet-4-20250514';
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function resolveDay(raw: string | null): string | null {
  const day = raw ?? new Date().toLocaleDateString('en-CA');
  if (!DAY_PATTERN.test(day)) return null;
  const parsed = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return day;
}

function toQuoteJson<T extends { displayDate: Date }>(quote: T) {
  return {
    ...quote,
    displayDate: quote.displayDate.toISOString().slice(0, 10),
  };
}

async function getOwnerBusinessId(userId: string): Promise<string | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { businessId: true },
  });
  return row?.businessId ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    if (user.role !== OWNER_ROLE) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const day = resolveDay(request.nextUrl.searchParams.get('date'));
    if (!day) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }

    const quote = await prisma.quote.findFirst({
      where: {
        userId: user.id,
        displayDate: new Date(`${day}T00:00:00Z`),
      },
    });

    return NextResponse.json({ quote: quote ? toQuoteJson(quote) : null });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    if (user.role !== OWNER_ROLE) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const day = resolveDay(request.nextUrl.searchParams.get('date'));
    if (!day) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }

    const displayDate = new Date(`${day}T00:00:00Z`);

    const existing = await prisma.quote.findFirst({
      where: { userId: user.id, displayDate },
    });
    if (existing) {
      return NextResponse.json({ quote: toQuoteJson(existing) });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('ANTHROPIC_API_KEY is not set; skipping quote generation');
      return NextResponse.json(
        { error: 'Anthropic is not configured' },
        { status: 503 },
      );
    }

    const businessId = await getOwnerBusinessId(user.id);
    if (!businessId) {
      return NextResponse.json(
        { error: 'Business setup is not complete' },
        { status: 400 },
      );
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, monthlyProjectTarget: true },
    });
    if (!business) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const goal = await prisma.goal.findFirst({
      where: {
        businessId,
        periodStart: { lte: displayDate },
        periodEnd: { gte: displayDate },
      },
      orderBy: { periodStart: 'desc' },
    });

    const monthStart = new Date(
      Date.UTC(displayDate.getUTCFullYear(), displayDate.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(displayDate.getUTCFullYear(), displayDate.getUTCMonth() + 1, 0, 23, 59, 59),
    );
    const completedThisMonth = await prisma.project.count({
      where: {
        businessId,
        status: 'COMPLETED',
        completedAt: { gte: monthStart, lte: monthEnd },
      },
    });

    const openChallenge = await prisma.quote.findFirst({
      where: { userId: user.id, challengeStatus: 'open' },
      orderBy: { displayDate: 'desc' },
      select: { challengeText: true },
    });

    const target = business.monthlyProjectTarget;
    const goalTarget = goal?.targetProjectCount ?? target;
    const goalCompleted = goal
      ? goal.completedCount
      : completedThisMonth;
    const progressPercent =
      goalTarget > 0 ? Math.round((goalCompleted / goalTarget) * 100) : 0;

    const prompt = [
      'Write today\'s motivational quote for the owner of a small video-editing business.',
      `Business name: ${business.name}`,
      `Monthly project target: ${target}`,
      `Current goal: ${goal ? goal.title : 'none set'}`,
      `Goal progress: ${goalCompleted} of ${goalTarget} projects (${progressPercent}%)`,
      `Projects completed this month: ${completedThisMonth}`,
      `Previous challenge (if any): ${openChallenge?.challengeText ?? 'none'}`,
      '',
      'Respond ONLY with a JSON object with these string keys:',
      '{"text": "the quote", "author": "who said it or empty string", "personalSuggestion": "one tailored suggestion based on the progress", "challengeText": "one small achievable challenge for today"}',
    ].join('\n');

    let generated: {
      text: string;
      author?: string;
      personalSuggestion?: string;
      challengeText?: string;
    };

    try {
      const client = new Anthropic({ apiKey });
      const message = await client.messages.create({
        model: MODEL,
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      });
      const block = message.content.find((b) => b.type === 'text');
      const raw = block && block.type === 'text' ? block.text : '';
      const jsonStart = raw.indexOf('{');
      const jsonEnd = raw.lastIndexOf('}');
      generated = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
    } catch (err) {
      console.error('Quote generation failed', err);
      return NextResponse.json(
        { error: 'Quote generation failed' },
        { status: 502 },
      );
    }

    if (!generated || typeof generated.text !== 'string' || !generated.text.trim()) {
      return NextResponse.json(
        { error: 'Quote generation failed' },
        { status: 502 },
      );
    }

    const quote = await prisma.quote.create({
      data: {
        text: generated.text,
        author: generated.author || null,
        personalSuggestion: generated.personalSuggestion || null,
        challengeText: generated.challengeText || null,
        challengeStatus: generated.challengeText ? 'open' : null,
        displayDate,
        isFavourite: false,
        businessId,
        userId: user.id,
      },
    });

    return NextResponse.json({ quote: toQuoteJson(quote) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}