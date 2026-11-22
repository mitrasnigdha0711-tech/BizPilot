import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';
import {
  InsightSource,
  InsightType,
  InvoiceStatus,
  PaymentStatus,
  Priority,
  Role,
} from '@prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_OVERDUE_ALERTS = 10;
const MAX_AI_INSIGHTS = 5;

type AiDraft = {
  type: InsightType;
  title: string;
  body: string;
  recommendedAction: string | null;
  priority: Priority;
};

type OverdueRow = {
  invoiceId: string;
  invoiceNumber: string;
  balanceDue: number;
  dueDate: Date;
  daysOverdue: number;
  status: InvoiceStatus;
};

function toNum(v: { toString(): string } | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseDrafts(text: string): AiDraft[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON array in model response');
  }
  const parsed: unknown = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error('Model response is not an array');

  const allowedTypes = ['BUSINESS_ADVICE', 'GROWTH_INSIGHT', 'NEXT_ACTION'];
  const allowedPriorities = ['LOW', 'MEDIUM', 'HIGH'];
  const drafts: AiDraft[] = [];

  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Record<string, unknown>;
    const title = typeof r.title === 'string' ? r.title.trim() : '';
    const body = typeof r.body === 'string' ? r.body.trim() : '';
    if (!title || !body) continue;
    const type =
      typeof r.type === 'string' && allowedTypes.includes(r.type)
        ? (r.type as InsightType)
        : InsightType.NEXT_ACTION;
    const priority =
      typeof r.priority === 'string' && allowedPriorities.includes(r.priority)
        ? (r.priority as Priority)
        : Priority.MEDIUM;
    const recommendedAction =
      typeof r.recommendedAction === 'string' && r.recommendedAction.trim()
        ? r.recommendedAction.trim()
        : null;
    drafts.push({ type, title, body, recommendedAction, priority });
    if (drafts.length >= MAX_AI_INSIGHTS) break;
  }
  return drafts;
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, role: true, businessId: true },
  });
  if (!dbUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (dbUser.role !== Role.FREELANCE_VIDEO_EDITOR) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!dbUser.businessId) {
    return NextResponse.json({ error: 'Business setup required' }, { status: 400 });
  }
  const businessId = dbUser.businessId;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('ANTHROPIC_API_KEY is not set; skipping insight generation');
    return NextResponse.json({ error: 'Anthropic is not configured' }, { status: 503 });
  }

  const url = new URL(request.url);
  const requestedDay = url.searchParams.get('date');
  const dayStr =
    requestedDay && /^\d{4}-\d{2}-\d{2}$/.test(requestedDay)
      ? requestedDay
      : new Date().toLocaleDateString('en-CA');
  const today = new Date(`${dayStr}T00:00:00Z`);
  if (Number.isNaN(today.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }
  const thirtyDaysAgo = new Date(today.getTime() - 30 * DAY_MS);
  const weekAhead = new Date(today.getTime() + 7 * DAY_MS);

  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { currency: true, monthlyProjectTarget: true },
    });

    const invoices = await prisma.invoice.findMany({
      where: {
        userId: user.id,
        businessId,
        balanceDue: { gt: 0 },
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE] },
      },
      select: {
        id: true,
        invoiceNumber: true,
        balanceDue: true,
        dueDate: true,
        status: true,
      },
    });

    const overdue: OverdueRow[] = invoices
      .filter((inv) => inv.dueDate.getTime() < today.getTime())
      .map((inv) => ({
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        balanceDue: round2(toNum(inv.balanceDue)),
        dueDate: inv.dueDate,
        daysOverdue: Math.floor((today.getTime() - inv.dueDate.getTime()) / DAY_MS),
        status: inv.status,
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    const outstandingTotal = round2(
      invoices.reduce((sum, inv) => sum + toNum(inv.balanceDue), 0),
    );
    const overdueTotal = round2(overdue.reduce((sum, o) => sum + o.balanceDue, 0));

    const activeProjects = await prisma.project.findMany({
      where: { userId: user.id, businessId, status: { in: ['PLANNED', 'IN_PROGRESS'] as never } },
      select: { name: true, deadline: true, status: true },
    });
    const dueSoon = activeProjects.filter(
      (p) => p.deadline.getTime() >= today.getTime() && p.deadline.getTime() <= weekAhead.getTime(),
    ).length;

    const expenseAgg = await prisma.expens.aggregate({
      where: { userId: user.id, businessId, expenseDate: { gte: thirtyDaysAgo, lte: today } },
      _sum: { amount: true },
    });
    const receivedAgg = await prisma.payment.aggregate({
      where: {
        userId: user.id,
        status: PaymentStatus.RECEIVED,
        receivedAt: { gte: thirtyDaysAgo, lte: today },
      },
      _sum: { amount: true },
    });

    const activeGoal = await prisma.goal.findFirst({
      where: { userId: user.id, businessId, periodStart: { lte: today }, periodEnd: { gte: today } },
      select: { title: true, targetProjectCount: true, completedCount: true },
    });

    const metrics = {
      currency: business?.currency ?? 'USD',
      monthlyProjectTarget: business?.monthlyProjectTarget ?? 0,
      outstandingTotal,
      overdueInvoiceCount: overdue.length,
      overdueTotal,
      oldestOverdueDays: overdue[0]?.daysOverdue ?? 0,
      activeProjectCount: activeProjects.length,
      projectsDueWithin7Days: dueSoon,
      expensesLast30Days: round2(toNum(expenseAgg._sum.amount)),
      paymentsReceivedLast30Days: round2(toNum(receivedAgg._sum.amount)),
      activeGoal: activeGoal
        ? {
            title: activeGoal.title,
            targetProjectCount: activeGoal.targetProjectCount,
            completedCount: activeGoal.completedCount,
          }
        : null,
    };

    const overdueSummary = overdue.slice(0, MAX_OVERDUE_ALERTS).map((o) => ({
      invoiceNumber: o.invoiceNumber,
      balanceDue: o.balanceDue,
      daysOverdue: o.daysOverdue,
      status: o.status,
    }));

    const prompt = [
      'You are a business advisor for a freelance video editor.',
      'Using only the aggregated business metrics below, write 3 to 5 personalised next-step suggestions and growth or business advice.',
      'Do not repeat overdue invoice alerts; those are handled separately.',
      'Respond with ONLY a JSON array. Each item: {"type": "NEXT_ACTION" | "GROWTH_INSIGHT" | "BUSINESS_ADVICE", "title": string, "body": string, "recommendedAction": string, "priority": "LOW" | "MEDIUM" | "HIGH"}.',
      '',
      `Metrics: ${JSON.stringify(metrics)}`,
      `Overdue invoices: ${JSON.stringify(overdueSummary)}`,
    ].join('\n');

    let drafts: AiDraft[];
    try {
      const anthropic = new Anthropic({ apiKey, timeout: 30_000, maxRetries: 1 });
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      });
      const text = message.content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('');
      drafts = parseDrafts(text);
    } catch (err) {
      console.error('Anthropic insight generation failed', err);
      return NextResponse.json(
        { error: 'Insight generation failed' },
        { status: 502 },
      );
    }

    const generatedAt = new Date();

    const alertRows = overdue.slice(0, MAX_OVERDUE_ALERTS).map((o) => ({
      type: InsightType.ALERT,
      title: `Invoice ${o.invoiceNumber} is ${o.daysOverdue} days overdue`,
      body: `${o.balanceDue} ${metrics.currency} remains unpaid after its due date.`,
      recommendedAction: 'Review the balance and send a payment reminder.',
      priority: Priority.HIGH,
      source: InsightSource.SYSTEM,
      isAlert: true,
      dueDate: o.dueDate,
      invoiceId: o.invoiceId,
    }));

    const adviceRows = drafts.map((d) => ({
      type: d.type,
      title: d.title,
      body: d.body,
      recommendedAction: d.recommendedAction,
      priority: d.priority,
      source: InsightSource.AI,
      isAlert: false,
      dueDate: null,
      invoiceId: null,
    }));

    const rows = [...alertRows, ...adviceRows];

    // Save atomically: earlier suggestions are marked stale and the new set is
    // inserted together, so a failure never leaves a partial result behind.
    const results = await prisma.$transaction([
      prisma.insight.updateMany({
        where: { userId: user.id, businessId, isStale: false },
        data: { isStale: true },
      }),
      ...rows.map((row) =>
        prisma.insight.create({
          data: {
            type: row.type,
            title: row.title,
            body: row.body,
            recommendedAction: row.recommendedAction,
            priority: row.priority,
            source: row.source,
            isAlert: row.isAlert,
            dueDate: row.dueDate,
            generatedAt,
            invoiceId: row.invoiceId,
            userId: user.id,
            businessId,
          },
        }),
      ),
    ]);

    const insights = results.slice(1);

    return NextResponse.json({ generated: insights.length, insights });
  } catch (err) {
    console.error('POST /api/my/insights/generate failed', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}