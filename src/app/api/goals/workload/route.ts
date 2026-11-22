import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { prisma } from '@/lib/db';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function localDay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseMinutes(hhmm: string | null | undefined): number {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(':').map((part) => Number(part));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const me = await prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true, businessId: true },
    });
    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Role values are stored as small_video_editing_business_owner; the enum
    // name may come back upper-cased, so compare case-insensitively.
    const role = String(me.role).toLowerCase();
    if (role !== 'SMALL_VIDEO_EDITING_BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!me.businessId) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const business = await prisma.business.findUnique({
      where: { id: me.businessId },
    });
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    const day = dateParam && DATE_RE.test(dateParam) ? dateParam : localDay();
    const [yearStr, monthStr] = day.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);

    // Calendar-month period, stored as UTC midnight dates.
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 0));
    const nextMonthStart = new Date(Date.UTC(year, month, 1));

    const goal = await prisma.goal.findFirst({
      where: {
        businessId: business.id,
        periodStart: { gte: periodStart, lt: nextMonthStart },
      },
    });

    const targetProjectCount =
      goal?.targetProjectCount ?? business.monthlyProjectTarget ?? 0;

    const [activeProjects, completedCount] = await Promise.all([
      prisma.project.count({
        where: {
          businessId: business.id,
          status: { in: ['PLANNED', 'IN_PROGRESS'] },
          deadline: { gte: periodStart, lte: periodEnd },
        },
      }),
      prisma.project.count({
        where: {
          businessId: business.id,
          status: 'COMPLETED',
          completedAt: { gte: periodStart, lt: nextMonthStart },
        },
      }),
    ]);

    const startMinutes = parseMinutes(business.workingHoursStart);
    const endMinutes = parseMinutes(business.workingHoursEnd);
    const capacityHoursPerWeek = round2(
      (Math.max(0, endMinutes - startMinutes) / 60) * 5,
    );

    const loadRatio =
      targetProjectCount > 0 ? round2(activeProjects / targetProjectCount) : 0;

    return NextResponse.json({
      workload: {
        period_start: periodStart.toISOString().slice(0, 10),
        period_end: periodEnd.toISOString().slice(0, 10),
        active_projects: activeProjects,
        target_project_count: targetProjectCount,
        completed_count: completedCount,
        capacity_hours_per_week: capacityHoursPerWeek,
        load_ratio: loadRatio,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}