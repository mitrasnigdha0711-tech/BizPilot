import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  GoalStatus,
  InsightSource,
  InsightStatus,
  InsightType,
  InvoiceStatus,
  Priority,
  ProjectStatus,
  Prisma,
} from '@prisma/client';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const MODEL = 'claude-sonnet-4-5';
const DAY_MS = 86_400_000;
const MAX_AI_ITEMS = 8;
const MAX_OVERDUE_ALERTS = 20;
const OPEN_INVOICE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];
const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = [ProjectStatus.PLANNED, ProjectStatus.IN_PROGRESS];

const SYSTEM_PROMPT = `You are BizPilot's business advisor for a freelance video editor or a small video-editing business.
You receive aggregated business metrics and invoice, project, expense, goal and forecast facts as JSON.
Write personalised business advice and growth insights grounded ONLY in the facts provided. Do not invent numbers.
Do not mention overdue invoices as alerts; those are handled separately.
Respond with ONLY a JSON array (no prose, no markdown) of up to ${MAX_AI_ITEMS} objects with keys:
"type" ("business_advice" | "growth_insight" | "next_action"),
"title" (short string),
"body" (2-3 sentences explaining the reasoning),
"recommendedAction" (one concrete action string),
"priority" ("low" | "medium" | "high").`;

type InvoiceFact = {
  id: string;
  invoiceNumber: string;
  clientId: string;
  status: InvoiceStatus;
  dueDate: Date;
  balanceDue: { toString(): string };
};

type AiDraft = {
  type: InsightType;
  title: string;
  body: string;
  recommendedAction: string | null;
  priority: Priority;
};

const toNum = (d: { toString(): string } | null | undefined): number =>
  d == null ? 0 : Number(d.toString());

const round2 = (n: number): number => Math.round(n * 100) / 100;

const toAiType = (value: unknown): InsightType => {
  if (value === 'growth_insight') return InsightType.GROWTH_INSIGHT;
  if (value === 'next_action') return InsightType.NEXT_ACTION;
  return InsightType.BUSINESS_ADVICE;
};

const toPriority = (value: unknown): Priority => {
  if (value === 'high') return Priority.HIGH;
  if (value === 'low') return Priority.LOW;
  return Priority.MEDIUM;
};

function parseAiItems(text: string): AiDraft[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end <= start) {
    throw new Error('No JSON array found in AI response');
  }
  const parsed: unknown = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(parsed)) {
    throw new Error('AI response is not an array');
  }

  const drafts: AiDraft[] = [];
  for (const raw of parsed.slice(0, MAX_AI_ITEMS)) {
    if (typeof raw !== 'object' || raw === null) continue;
    const item = raw as Record<string, unknown>;
    if (typeof item.title !== 'string' || typeof item.body !== 'string') continue;
    drafts.push({
      type: toAiType(item.type),
      title: item.title.slice(0, 200),
      body: item.body.slice(0, 2000),
      recommendedAction:
        typeof item.recommendedAction === 'string' ? item.recommendedAction.slice(0, 500) : null,
      priority: toPriority(item.priority),
    });
  }

  if (drafts.length === 0) {
    throw new Error('AI returned no usable insights');
  }
  return drafts;
}

async function requestAdvice(apiKey: string, facts: unknown): Promise<string> {
  const client = new Anthropic({ apiKey, timeout: 30_000, maxRetries: 1 });
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(facts) }],
  });
  return message.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('');
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (String(user.role).toLowerCase() !== 'small_video_editing_business_owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const dateParam = new URL(request.url).searchParams.get('date');
    if (dateParam !== null && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
    }
    const dayStr = dateParam ?? new Date().toLocaleDateString('en-CA');
    const today = new Date(`${dayStr}T00:00:00Z`);
    if (Number.isNaN(today.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { businessId: true },
    });
    const businessId = dbUser?.businessId;
    if (!businessId) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('ANTHROPIC_API_KEY is not set; skipping business insight generation');
      return NextResponse.json({ error: 'Anthropic is not configured' }, { status: 503 });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, currency: true, monthlyProjectTarget: true },
    });
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const expenseWindowStart = new Date(today.getTime() - 30 * DAY_MS);

    const [invoices, projects, expenses, activeGoal, forecastRows] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          businessId,
          status: { in: OPEN_INVOICE_STATUSES },
          balanceDue: { gt: 0 },
        },
        select: {
          id: true,
          invoiceNumber: true,
          clientId: true,
          status: true,
          dueDate: true,
          balanceDue: true,
        },
        orderBy: { dueDate: 'asc' },
      }) as Promise<InvoiceFact[]>,
      prisma.project.findMany({
        where: {
          businessId,
          OR: [
            { status: { in: ACTIVE_PROJECT_STATUSES } },
            { completedAt: { gte: monthStart } },
          ],
        },
        select: {
          name: true,
          status: true,
          deadline: true,
          value: true,
          completedAt: true,
          clientId: true,
        },
        orderBy: { deadline: 'asc' },
        take: 100,
      }),
      prisma.expens.findMany({
        where: {
          businessId,
          expenseDate: { gte: expenseWindowStart, lte: today },
        },
        select: { amount: true, category: true },
      }),
      prisma.goal.findFirst({
        where: {
          businessId,
          status: GoalStatus.ACTIVE,
          periodEnd: { gte: today },
        },
        orderBy: { periodEnd: 'asc' },
      }),
      prisma.cashflowForecast.findMany({
        where: { businessId },
        orderBy: { generatedAt: 'desc' },
        take: 12,
      }),
    ]);

    const clientIds = Array.from(
      new Set([...invoices.map((i) => i.clientId), ...projects.map((p) => p.clientId)]),
    );
    const clients = clientIds.length
      ? await prisma.client.findMany({
          where: { businessId, id: { in: clientIds } },
          select: { id: true, name: true },
        })
      : [];
    const clientNames = new Map(clients.map((c) => [c.id, c.name]));

    const overdueInvoices = invoices.filter((i) => i.dueDate.getTime() < today.getTime());
    const overdueTotal = overdueInvoices.reduce((sum, i) => sum + toNum(i.balanceDue), 0);
    const outstandingTotal = invoices.reduce((sum, i) => sum + toNum(i.balanceDue), 0);

    const activeProjects = projects.filter((p) => ACTIVE_PROJECT_STATUSES.includes(p.status));
    const completedThisMonth = projects.filter(
      (p) => p.completedAt !== null && p.completedAt.getTime() >= monthStart.getTime(),
    ).length;
    const projectsPastDeadline = activeProjects.filter(
      (p) => p.deadline.getTime() < today.getTime(),
    ).length;

    const expenseTotal = expenses.reduce((sum, e) => sum + toNum(e.amount), 0);
    const expenseByCategory: Record<string, number> = {};
    for (const e of expenses) {
      expenseByCategory[e.category] = round2(
        (expenseByCategory[e.category] ?? 0) + toNum(e.amount),
      );
    }

    let goalFact: {
      title: string;
      periodStart: string;
      periodEnd: string;
      targetProjectCount: number;
      completedCount: number;
    } | null = null;
    if (activeGoal) {
      const completedCount = await prisma.project.count({
        where: {
          businessId,
          status: ProjectStatus.COMPLETED,
          completedAt: { gte: activeGoal.periodStart, lte: activeGoal.periodEnd },
        },
      });
      goalFact = {
        title: activeGoal.title,
        periodStart: activeGoal.periodStart.toISOString().slice(0, 10),
        periodEnd: activeGoal.periodEnd.toISOString().slice(0, 10),
        targetProjectCount: activeGoal.targetProjectCount,
        completedCount,
      };
    }

    const latestByHorizon = new Map<number, (typeof forecastRows)[number]>();
    for (const row of forecastRows) {
      if (!latestByHorizon.has(row.horizonDays)) latestByHorizon.set(row.horizonDays, row);
    }

    const facts = {
      business: {
        currency: business.currency,
        monthlyProjectTarget: business.monthlyProjectTarget,
      },
      asOf: dayStr,
      metrics: {
        openInvoiceCount: invoices.length,
        outstandingTotal: round2(outstandingTotal),
        overdueInvoiceCount: overdueInvoices.length,
        overdueTotal: round2(overdueTotal),
        activeProjectCount: activeProjects.length,
        projectsPastDeadline,
        completedProjectsThisMonth: completedThisMonth,
        expensesLast30Days: round2(expenseTotal),
      },
      openInvoices: invoices.slice(0, 20).map((i) => ({
        invoiceNumber: i.invoiceNumber,
        clientName: clientNames.get(i.clientId) ?? 'Unknown client',
        balanceDue: round2(toNum(i.balanceDue)),
        dueDate: i.dueDate.toISOString().slice(0, 10),
        status: i.status,
      })),
      activeProjects: activeProjects.slice(0, 20).map((p) => ({
        name: p.name,
        status: p.status,
        deadline: p.deadline.toISOString().slice(0, 10),
        value: p.value === null ? null : round2(toNum(p.value)),
        clientName: clientNames.get(p.clientId) ?? 'Unknown client',
      })),
      expensesLast30DaysByCategory: expenseByCategory,
      activeGoal: goalFact,
      cashflowForecasts: Array.from(latestByHorizon.values()).map((f) => ({
        horizonDays: f.horizonDays,
        netCashflow: round2(toNum(f.netCashflow)),
        projectedBalance: f.projectedBalance === null ? null : round2(toNum(f.projectedBalance)),
        shortfallAmount: round2(toNum(f.shortfallAmount)),
      })),
    };

    let aiDrafts: AiDraft[];
    try {
      const text = await requestAdvice(apiKey, facts);
      aiDrafts = parseAiItems(text);
    } catch (err) {
      console.error('Business insight generation failed; previous insights kept', err);
      return NextResponse.json(
        { error: 'AI generation failed; previous insights were kept' },
        { status: 502 },
      );
    }

    const generatedAt = new Date();
    const nextActionDue = new Date(today.getTime() + 7 * DAY_MS);

    const alertRows: Prisma.InsightUncheckedCreateInput[] = overdueInvoices
      .slice(0, MAX_OVERDUE_ALERTS)
      .map((i) => {
        const daysOverdue = Math.floor((today.getTime() - i.dueDate.getTime()) / DAY_MS);
        const clientName = clientNames.get(i.clientId) ?? 'The client';
        return {
          type: InsightType.ALERT,
          title: `Invoice ${i.invoiceNumber} is ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} overdue`,
          body: `${clientName} has ${round2(toNum(i.balanceDue))} ${business.currency} outstanding, past its due date.`,
          recommendedAction: 'Send a payment reminder for this invoice',
          priority: Priority.HIGH,
          status: InsightStatus.OPEN,
          source: InsightSource.SYSTEM,
          isAlert: true,
          isStale: false,
          dueDate: i.dueDate,
          generatedAt,
          invoiceId: i.id,
          businessId,
          userId: user.id,
        };
      });

    const adviceRows: Prisma.InsightUncheckedCreateInput[] = aiDrafts.map((d) => ({
      type: d.type,
      title: d.title,
      body: d.body,
      recommendedAction: d.recommendedAction,
      priority: d.priority,
      status: InsightStatus.OPEN,
      source: InsightSource.AI,
      isAlert: false,
      isStale: false,
      dueDate: d.type === InsightType.NEXT_ACTION ? nextActionDue : null,
      generatedAt,
      businessId,
      userId: user.id,
    }));

    const insights = await prisma.$transaction(async (tx) => {
      await tx.insight.updateMany({
        where: { businessId, isStale: false, status: InsightStatus.OPEN },
        data: { isStale: true },
      });

      const created = [];
      for (const data of [...alertRows, ...adviceRows]) {
        created.push(await tx.insight.create({ data }));
      }
      return created;
    });

    return NextResponse.json({ generated: insights.length, insights });
  } catch (err) {
    console.error('POST /api/admin/insights/generate failed', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}