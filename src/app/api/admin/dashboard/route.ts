import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { Prisma } from '@prisma/client';
import type { Insight as InsightRecord } from '@prisma/client';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

const OWNER_ROLE = 'small_video_editing_business_owner';
const DAY_MS = 24 * 60 * 60 * 1000;
const FRESHNESS_MS = DAY_MS;
const AI_MODEL = 'claude-3-5-haiku-latest';
const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

function num(value: { toString(): string } | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

function toDateOnly(date: Date | null | undefined): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

function resolveToday(raw: string | null): Date | null {
  const day =
    raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? raw
      : new Date().toLocaleDateString('en-CA');
  const parsed = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function rankOf(priority: unknown): number {
  return PRIORITY_RANK[String(priority).toLowerCase()] ?? 3;
}

function toPriority(value: unknown): Priority {
  const s = String(value).toUpperCase();
  return s === 'HIGH' || s === 'LOW' ? s : 'MEDIUM';
}

function toInsightType(value: unknown): 'BUSINESS_ADVICE' | 'GROWTH_INSIGHT' | 'NEXT_ACTION' {
  const s = String(value).toLowerCase();
  if (s === 'growth_insight') return 'GROWTH_INSIGHT';
  if (s === 'business_advice') return 'BUSINESS_ADVICE';
  return 'NEXT_ACTION';
}

function toInsightJson(row: InsightRecord) {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    type: String(row.type).toLowerCase(),
    title: row.title,
    body: row.body,
    recommendedAction: row.recommendedAction,
    priority: String(row.priority).toLowerCase(),
    status: String(row.status).toLowerCase(),
    source: String(row.source).toLowerCase(),
    isAlert: row.isAlert,
    isStale: row.isStale,
    dueDate: toDateOnly(row.dueDate),
    periodStart: toDateOnly(row.periodStart),
    periodEnd: toDateOnly(row.periodEnd),
    generatedAt: row.generatedAt.toISOString(),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    dismissedAt: row.dismissedAt ? row.dismissedAt.toISOString() : null,
    invoiceId: row.invoiceId,
    projectId: row.projectId,
    businessId: row.businessId,
    userId: row.userId,
  };
}

async function regenerateAiInsights(
  businessId: string,
  userId: string,
  summary: { overdueCount: number; overdueTotal: number; activeProjects: number; dueSoon: number },
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[admin/dashboard] ANTHROPIC_API_KEY is not set; skipping AI insight generation');
    return;
  }

  const client = new Anthropic({ apiKey });
  const prompt = [
    'You are a business advisor for a small video-editing business.',
    `Overdue invoices: ${summary.overdueCount}, outstanding overdue total: ${summary.overdueTotal.toFixed(2)}.`,
    `Active projects: ${summary.activeProjects}, deadlines in the next 7 days: ${summary.dueSoon}.`,
    'Write up to 5 prioritized next actions and growth insights for the owner.',
    'Respond ONLY with a JSON array of objects with keys:',
    '"type" ("next_action" | "business_advice" | "growth_insight"), "title" (string), "body" (string),',
    '"recommended_action" (string), "priority" ("high" | "medium" | "low").',
  ].join('\n');

  let text = '';
  try {
    const message = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    text = message.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('');
  } catch (err) {
    console.error('[admin/dashboard] Anthropic request failed', err);
    return;
  }

  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) {
    console.warn('[admin/dashboard] Anthropic response contained no JSON array');
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    console.warn('[admin/dashboard] Could not parse Anthropic JSON');
    return;
  }
  if (!Array.isArray(parsed)) return;

  const items = parsed
    .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
    .filter((x) => typeof x.title === 'string' && typeof x.body === 'string')
    .slice(0, 5);

  if (items.length === 0) return;

  const now = new Date();
  await prisma.insight.updateMany({
    where: { businessId, source: 'AI', isStale: false },
    data: { isStale: true },
  });

  const rows = items.map((item): Prisma.InsightCreateManyInput => ({
    type: toInsightType(item.type),
    title: String(item.title).slice(0, 200),
    body: String(item.body),
    recommendedAction:
      typeof item.recommended_action === 'string' ? item.recommended_action : null,
    priority: toPriority(item.priority),
    status: 'OPEN',
    source: 'AI',
    isAlert: false,
    isStale: false,
    generatedAt: now,
    businessId,
    userId,
  }));

  await prisma.insight.createMany({ data: rows });
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (String(user.role).toLowerCase() !== OWNER_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const today = resolveToday(new URL(request.url).searchParams.get('date'));
    if (!today) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }
    const now = new Date();

    const business = await prisma.business.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    const businessId = business.id;

    // Overdue invoices: sent / partially paid past due with a balance become overdue.
    await prisma.invoice.updateMany({
      where: {
        businessId,
        status: { in: ['SENT', 'PARTIALLY_PAID'] },
        balanceDue: { gt: 0 },
        dueDate: { lt: today },
      },
      data: { status: 'OVERDUE' },
    });

    const overdueInvoices = await prisma.invoice.findMany({
      where: { businessId, status: 'OVERDUE', balanceDue: { gt: 0 } },
      orderBy: { dueDate: 'asc' },
    });
    const overdueIds = new Set(overdueInvoices.map((inv) => inv.id));

    // Create one system alert per overdue invoice that has never had one
    // (dismissed alerts are kept, so they stay hidden).
    if (overdueInvoices.length > 0) {
      const existing = await prisma.insight.findMany({
        where: { businessId, isAlert: true, invoiceId: { in: [...overdueIds] } },
        select: { invoiceId: true },
      });
      const alreadyAlerted = new Set(existing.map((e) => e.invoiceId));

      const newAlerts = overdueInvoices
        .filter((inv) => !alreadyAlerted.has(inv.id))
        .map((inv): Prisma.InsightCreateManyInput => ({
          type: 'ALERT',
          title: `Overdue invoice ${inv.invoiceNumber}`,
          body: `Invoice ${inv.invoiceNumber} is past due with ${num(inv.balanceDue).toFixed(2)} still unpaid.`,
          recommendedAction: 'Send a payment reminder to the client',
          priority: 'HIGH',
          status: 'OPEN',
          source: 'SYSTEM',
          isAlert: true,
          isStale: false,
          dueDate: inv.dueDate,
          generatedAt: now,
          invoiceId: inv.id,
          businessId,
          userId: user.id,
        }));

      if (newAlerts.length > 0) {
        await prisma.insight.createMany({ data: newAlerts });
      }
    }

    // Active projects with a deadline within 7 days (overdue active ones included).
    const horizonEnd = new Date(today.getTime() + 7 * DAY_MS);
    const activeStatuses: ('PLANNED' | 'IN_PROGRESS')[] = ['PLANNED', 'IN_PROGRESS'];
    const deadlineProjects = await prisma.project.findMany({
      where: {
        businessId,
        status: { in: activeStatuses },
        deadline: { lte: horizonEnd },
      },
      orderBy: { deadline: 'asc' },
    });
    const activeProjects = await prisma.project.count({
      where: { businessId, status: { in: activeStatuses } },
    });

    // Refresh AI suggestions when stored ones are older than the freshness window.
    const latestAi = await prisma.insight.findFirst({
      where: { businessId, source: 'AI', isStale: false },
      orderBy: { generatedAt: 'desc' },
      select: { generatedAt: true },
    });
    const isStale = !latestAi || now.getTime() - latestAi.generatedAt.getTime() > FRESHNESS_MS;
    if (isStale) {
      try {
        await regenerateAiInsights(businessId, user.id, {
          overdueCount: overdueInvoices.length,
          overdueTotal: overdueInvoices.reduce((sum, inv) => sum + num(inv.balanceDue), 0),
          activeProjects,
          dueSoon: deadlineProjects.length,
        });
      } catch (err) {
        console.error('[admin/dashboard] AI insight regeneration failed', err);
      }
    }

    // Alerts: active, undismissed, unexpired alerts; invoice-linked ones must still be overdue.
    const alertRows = await prisma.insight.findMany({
      where: {
        businessId,
        isAlert: true,
        status: 'OPEN',
        isStale: false,
        dismissedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    const alerts = alertRows
      .filter((a) => !a.invoiceId || overdueIds.has(a.invoiceId))
      .sort((a, b) => {
        const byPriority = rankOf(a.priority) - rankOf(b.priority);
        if (byPriority !== 0) return byPriority;
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
      .map(toInsightJson);

    // Next steps: up to 5 open recommendations ranked by priority, then due date.
    const nextRows = await prisma.insight.findMany({
      where: {
        businessId,
        isAlert: false,
        status: 'OPEN',
        isStale: false,
        dismissedAt: null,
        recommendedAction: { not: null },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      take: 50,
    });
    const next_steps = nextRows
      .sort((a, b) => {
        const byPriority = rankOf(a.priority) - rankOf(b.priority);
        if (byPriority !== 0) return byPriority;
        const aDue = a.dueDate ? a.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
        const bDue = b.dueDate ? b.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
        return aDue - bDue;
      })
      .slice(0, 5)
      .map(toInsightJson);

    const upcoming_deadlines = deadlineProjects.map((project) => {
      const days_remaining = Math.round((project.deadline.getTime() - today.getTime()) / DAY_MS);
      return {
        project: {
          id: project.id,
          createdAt: project.createdAt.toISOString(),
          updatedAt: project.updatedAt.toISOString(),
          name: project.name,
          clientId: project.clientId,
          status: String(project.status).toLowerCase(),
          startDate: toDateOnly(project.startDate),
          deadline: toDateOnly(project.deadline),
          value: project.value === null ? null : num(project.value),
          completedAt: project.completedAt ? project.completedAt.toISOString() : null,
          businessId: project.businessId,
          userId: project.userId,
        },
        days_remaining,
        is_overdue: days_remaining < 0,
      };
    });

    // Cashflow summary: latest stored forecast per horizon.
    const forecasts = await prisma.cashflowForecast.findMany({
      where: { businessId },
      orderBy: { generatedAt: 'desc' },
      take: 30,
    });
    const latest = new Map<number, (typeof forecasts)[number]>();
    for (const forecast of forecasts) {
      if (!latest.has(forecast.horizonDays)) latest.set(forecast.horizonDays, forecast);
    }
    const cashflow_summary = [30, 60, 90]
      .filter((horizon) => latest.has(horizon))
      .map((horizon) => {
        const f = latest.get(horizon)!;
        return {
          horizon_days: f.horizonDays,
          net_cashflow: num(f.netCashflow),
          shortfall_amount: num(f.shortfallAmount),
        };
      });

    return NextResponse.json({
      next_steps,
      alerts,
      upcoming_deadlines,
      cashflow_summary,
    });
  } catch (err) {
    console.error('[admin/dashboard] GET failed', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}