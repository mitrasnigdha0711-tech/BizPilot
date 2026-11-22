import { NextRequest, NextResponse } from 'next/server';
import {
  InsightStatus,
  InvoiceStatus,
  Priority,
  ProjectStatus,
  type CashflowForecast,
  type Insight,
  type Project,
} from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ROLE = 'freelance_video_editor';
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const NEXT_STEP_LIMIT = 5;
const DEADLINE_WINDOW_DAYS = 7;
const HORIZONS = [30, 60, 90] as const;

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function lower(v: string): string {
  return v.toLowerCase();
}

function serializeInsight(i: Insight) {
  return {
    id: i.id,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
    type: lower(i.type),
    title: i.title,
    body: i.body,
    recommendedAction: i.recommendedAction,
    priority: lower(i.priority),
    status: lower(i.status),
    source: lower(i.source),
    isAlert: i.isAlert,
    isStale: i.isStale,
    dueDate: iso(i.dueDate),
    periodStart: iso(i.periodStart),
    periodEnd: iso(i.periodEnd),
    generatedAt: i.generatedAt.toISOString(),
    expiresAt: iso(i.expiresAt),
    dismissedAt: iso(i.dismissedAt),
    invoiceId: i.invoiceId,
    projectId: i.projectId,
    businessId: i.businessId,
    userId: i.userId,
  };
}

function serializeProject(p: Project) {
  return {
    id: p.id,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    name: p.name,
    clientId: p.clientId,
    status: lower(p.status),
    startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : null,
    deadline: p.deadline.toISOString().slice(0, 10),
    value: p.value === null ? null : num(p.value),
    completedAt: iso(p.completedAt),
    businessId: p.businessId,
    userId: p.userId,
  };
}

function serializeForecast(f: CashflowForecast) {
  return {
    horizon_days: f.horizonDays,
    net_cashflow: num(f.netCashflow),
    shortfall_amount: num(f.shortfallAmount),
  };
}

function rankInsight(a: Insight, b: Insight): number {
  const pa = PRIORITY_RANK[lower(a.priority)] ?? 3;
  const pb = PRIORITY_RANK[lower(b.priority)] ?? 3;
  if (pa !== pb) return pa - pb;
  const da = a.dueDate ? a.dueDate.getTime() : Number.POSITIVE_INFINITY;
  const db = b.dueDate ? b.dueDate.getTime() : Number.POSITIVE_INFINITY;
  if (da !== db) return da - db;
  return b.createdAt.getTime() - a.createdAt.getTime();
}

export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (String(user.role ?? '').toLowerCase() !== ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const requested = new URL(request.url).searchParams.get('date');
  let day: string;
  if (requested) {
    if (!DAY_RE.test(requested)) {
      return NextResponse.json({ error: 'Invalid date, expected YYYY-MM-DD' }, { status: 400 });
    }
    day = requested;
  } else {
    day = new Date().toLocaleDateString('en-CA');
  }

  const todayUtc = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(todayUtc.getTime())) {
    return NextResponse.json({ error: 'Invalid date, expected YYYY-MM-DD' }, { status: 400 });
  }

  try {
    const openInsightWhere = {
      userId: user.id,
      status: InsightStatus.OPEN,
      dismissedAt: null,
      isStale: false,
      OR: [{ expiresAt: null }, { expiresAt: { gt: todayUtc } }],
    };

    const [openInsights, alertCandidates, projects, forecasts] = await Promise.all([
      prisma.insight.findMany({
        where: { ...openInsightWhere, isAlert: false },
        take: 50,
      }),
      prisma.insight.findMany({
        where: { ...openInsightWhere, isAlert: true, priority: Priority.HIGH },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.project.findMany({
        where: {
          userId: user.id,
          status: { in: [ProjectStatus.PLANNED, ProjectStatus.IN_PROGRESS] },
          deadline: { lte: addDays(todayUtc, DEADLINE_WINDOW_DAYS) },
        },
        orderBy: { deadline: 'asc' },
      }),
      Promise.all(
        HORIZONS.map((horizon) =>
          prisma.cashflowForecast.findFirst({
            where: { userId: user.id, horizonDays: horizon },
            orderBy: { generatedAt: 'desc' },
          }),
        ),
      ),
    ]);

    // Overdue-payment alerts stay visible only while the invoice is still overdue and unpaid.
    const linkedInvoiceIds = alertCandidates
      .map((a) => a.invoiceId)
      .filter((id): id is string => Boolean(id));

    const stillOverdue = new Set<string>();
    if (linkedInvoiceIds.length > 0) {
      const invoices = await prisma.invoice.findMany({
        where: {
          id: { in: linkedInvoiceIds },
          userId: user.id,
          status: InvoiceStatus.OVERDUE,
          balanceDue: { gt: 0 },
        },
        select: { id: true },
      });
      for (const inv of invoices) stillOverdue.add(inv.id);
    }

    const alerts = alertCandidates
      .filter((a) => !a.invoiceId || stillOverdue.has(a.invoiceId))
      .sort(rankInsight);

    const nextSteps = [...openInsights].sort(rankInsight).slice(0, NEXT_STEP_LIMIT);

    const upcomingDeadlines = projects.map((project) => {
      const daysRemaining = Math.round((project.deadline.getTime() - todayUtc.getTime()) / DAY_MS);
      return {
        project: serializeProject(project),
        days_remaining: daysRemaining,
        is_overdue: daysRemaining < 0,
      };
    });

    const cashflowSummary = forecasts
      .filter((f): f is CashflowForecast => f !== null)
      .map(serializeForecast);

    return NextResponse.json({
      dashboard: {
        next_steps: nextSteps.map(serializeInsight),
        alerts: alerts.map(serializeInsight),
        upcoming_deadlines: upcomingDeadlines,
        cashflow_summary: cashflowSummary,
      },
    });
  } catch (error) {
    console.error('GET /api/my/dashboard failed', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}