import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MODEL = 'claude-3-5-haiku-latest';

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isValidDay(day: string): boolean {
  return DAY_RE.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`));
}

function buildPrompt(args: {
  monthlyProjectTarget: number | null;
  goalTitle: string | null;
  goalTarget: number | null;
  goalCompleted: number | null;
  openTaskCount: number;
}): string {
  const goalLine = args.goalTitle
    ? `Current goal: "${args.goalTitle}" - ${args.goalCompleted ?? 0} of ${args.goalTarget ?? 0} projects completed.`
    : 'No goal is set for this period.';
  const targetLine =
    args.monthlyProjectTarget !== null
      ? `Monthly project target: ${args.monthlyProjectTarget}.`
      : 'No monthly project target is set.';

  return [
    'You write a short daily motivation for a freelance video editor or small video-editing business owner.',
    goalLine,
    targetLine,
    `Open tasks on their list: ${args.openTaskCount}.`,
    'Return ONLY a JSON object with these string keys:',
    '"text" (one motivational quote, under 30 words),',
    '"author" (the quote author, or "BizPilot" if original),',
    '"personalSuggestion" (one practical suggestion based on the goal and progress above, under 40 words),',
    '"challengeText" (one small actionable challenge for today, under 20 words).',
    'No markdown, no commentary.',
  ].join('\n');
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const url = new URL(request.url);
  const day = url.searchParams.get('date') ?? localToday();
  if (!isValidDay(day)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }
  const displayDate = new Date(`${day}T00:00:00Z`);

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { businessId: true },
    });
    if (!dbUser?.businessId) {
      return NextResponse.json({ error: 'Business setup is required' }, { status: 400 });
    }
    const businessId = dbUser.businessId;

    const existing = await prisma.quote.findFirst({
      where: { userId: user.id, displayDate },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return NextResponse.json({ quote: { ...existing, displayDate: day } });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('ANTHROPIC_API_KEY is not set; skipping quote generation');
      return NextResponse.json(
        { error: 'Anthropic is not configured' },
        { status: 503 },
      );
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { monthlyProjectTarget: true },
    });
    const goal = await prisma.goal.findFirst({
      where: {
        businessId,
        periodStart: { lte: displayDate },
        periodEnd: { gte: displayDate },
      },
      orderBy: { periodStart: 'desc' },
    });
    const openTaskCount = await prisma.task.count({
      where: { userId: user.id, status: 'OPEN' as never },
    });

    const prompt = buildPrompt({
      monthlyProjectTarget: business?.monthlyProjectTarget ?? null,
      goalTitle: goal?.title ?? null,
      goalTarget: goal?.targetProjectCount ?? null,
      goalCompleted: goal?.completedCount ?? null,
      openTaskCount,
    });

    let parsed: {
      text: string;
      author: string;
      personalSuggestion: string;
      challengeText: string;
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
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) {
        return NextResponse.json({ error: 'Quote generation failed' }, { status: 502 });
      }
      const data = JSON.parse(match[0]) as Record<string, unknown>;
      const text = typeof data.text === 'string' ? data.text.trim() : '';
      if (!text) {
        return NextResponse.json({ error: 'Quote generation failed' }, { status: 502 });
      }
      parsed = {
        text,
        author: typeof data.author === 'string' ? data.author : 'BizPilot',
        personalSuggestion:
          typeof data.personalSuggestion === 'string' ? data.personalSuggestion : '',
        challengeText: typeof data.challengeText === 'string' ? data.challengeText.trim() : '',
      };
    } catch (aiError) {
      console.error('Quote generation via Anthropic failed', aiError);
      return NextResponse.json({ error: 'Quote generation failed' }, { status: 502 });
    }

    const quote = await prisma.quote.create({
      data: {
        text: parsed.text,
        author: parsed.author,
        personalSuggestion: parsed.personalSuggestion || null,
        displayDate,
        isFavourite: false,
        businessId,
        userId: user.id,
        challengeText: parsed.challengeText || null,
        challengeStatus: parsed.challengeText ? 'open' : null,
      },
    });

    return NextResponse.json({ quote: { ...quote, displayDate: day } });
  } catch (e) {
    console.error('POST /api/my/quotes/generate failed', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}