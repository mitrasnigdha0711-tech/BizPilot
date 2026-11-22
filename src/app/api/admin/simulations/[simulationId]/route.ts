import { NextResponse } from 'next/server';
import {
  Prisma,
  InvoiceStatus,
  SimulationScenarioType,
  SimulationStatus,
} from '@prisma/client';
import type { Simulation } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { simulationId: string } };

const OWNER_ROLE = 'small_video_editing_business_owner';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 86_400_000;
const HORIZONS = [30, 60, 90];
const UNPAID_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

class ValidationError extends Error {}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function handleError(error: unknown): Response {
  if (error instanceof ValidationError) return jsonError(error.message, 400);
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
    return jsonError('Not found', 404);
  }
  return jsonError('Internal error', 500);
}

async function requireOwner(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (user.role !== OWNER_ROLE) return jsonError('Not available for your role', 403);
  return user;
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError('Invalid JSON body');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  return body as Record<string, unknown>;
}

function parseDelayDays(raw: unknown): number {
  let value: unknown = raw;
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) value = Number(value);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ValidationError('Enter a whole number of delay days between 1 and 180.');
  }
  if (!Number.isInteger(value)) {
    throw new ValidationError('Delay days must be a whole number, such as 14 or 30.');
  }
  if (value < 1 || value > 180) {
    throw new ValidationError('Enter a whole number of delay days between 1 and 180.');
  }
  return value;
}

async function loadUnpaidInvoice(invoiceId: unknown, userId: string) {
  const message = 'Please select an unpaid invoice for this simulation.';
  if (typeof invoiceId !== 'string' || !UUID_RE.test(invoiceId)) throw new ValidationError(message);
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId },
    select: { id: true, status: true, balanceDue: true, dueDate: true },
  });
  if (!invoice || !UNPAID_STATUSES.includes(invoice.status) || Number(invoice.balanceDue.toString()) <= 0) {
    throw new ValidationError(message);
  }
  return invoice;
}

function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function parseDay(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function todayUtc(): Date {
  const local = new Date().toLocaleDateString('en-CA');
  return new Date(`${local}T00:00:00Z`);
}

function num(value: { toString(): string } | null | undefined): number {
  return value == null ? 0 : Number(value.toString());
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function buildHorizons(simulation: Simulation, day: Date) {
  const forecasts = await prisma.cashflowForecast.findMany({
    where: { businessId: simulation.businessId, horizonDays: { in: HORIZONS } },
    orderBy: { generatedAt: 'desc' },
    select: {
      horizonDays: true,
      projectedInflow: true,
      projectedOutflow: true,
      baselineBalance: true,
    },
  });

  const latest = new Map<number, (typeof forecasts)[number]>();
  for (const f of forecasts) {
    if (!latest.has(f.horizonDays)) latest.set(f.horizonDays, f);
  }

  const invoice =
    simulation.invoiceId && simulation.projectedPaymentDate
      ? await prisma.invoice.findFirst({
          where: { id: simulation.invoiceId, userId: simulation.userId },
          select: { balanceDue: true, dueDate: true },
        })
      : null;

  const delayed =
    invoice && simulation.projectedPaymentDate
      ? {
          balance: num(invoice.balanceDue),
          dueMs: utcDay(invoice.dueDate),
          paidMs: utcDay(simulation.projectedPaymentDate),
        }
      : null;

  return HORIZONS.map((horizonDays) => {
    const f = latest.get(horizonDays);
    const horizonEnd = utcDay(day) + horizonDays * DAY_MS;
    const baselineInflow = num(f?.projectedInflow);
    const baselineOutflow = num(f?.projectedOutflow);
    const baselineBalance = num(f?.baselineBalance);

    let moved = 0;
    if (delayed && delayed.dueMs <= horizonEnd && delayed.paidMs > horizonEnd) {
      moved = Math.min(delayed.balance, baselineInflow);
    }

    const projectedInflow = baselineInflow - moved;
    const projectedNet = projectedInflow - baselineOutflow;
    const projectedBalance = round2(baselineBalance + projectedNet);

    return {
      horizon_days: horizonDays,
      baseline_inflow: round2(baselineInflow),
      projected_inflow: round2(projectedInflow),
      projected_balance: projectedBalance,
      shortfall_amount: round2(Math.max(0, -projectedBalance)),
    };
  });
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireOwner(request);
    if (auth instanceof Response) return auth;

    if (!UUID_RE.test(params.simulationId)) return jsonError('Not found', 404);

    const simulation = await prisma.simulation.findFirst({
      where: { id: params.simulationId, userId: auth.id },
    });
    if (!simulation) return jsonError('Not found', 404);

    const day = parseDay(new URL(request.url).searchParams.get('date')) ?? todayUtc();
    const horizons = await buildHorizons(simulation, day);

    return NextResponse.json({ simulation, horizons });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireOwner(request);
    if (auth instanceof Response) return auth;

    if (!UUID_RE.test(params.simulationId)) return jsonError('Not found', 404);

    const existing = await prisma.simulation.findFirst({
      where: { id: params.simulationId, userId: auth.id },
    });
    if (!existing) return jsonError('Not found', 404);
    if (existing.status === SimulationStatus.COMPLETED) {
      return jsonError('Completed simulations cannot be changed', 409);
    }

    const body = await readBody(request);
    const data: Prisma.SimulationUncheckedUpdateInput = {};

    if ('name' in body) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        throw new ValidationError('Simulation name is required.');
      }
      const name = body.name.trim();
      if (name.length > 80) {
        throw new ValidationError('Simulation name must be 80 characters or fewer.');
      }
      data.name = name;
    }

    const touchesDelay = 'invoiceId' in body || 'delayDays' in body;
    if (touchesDelay) {
      if (existing.scenarioType !== SimulationScenarioType.DELAYED_PAYMENT) {
        throw new ValidationError('Custom scenarios take only a name.');
      }
      const invoice = await loadUnpaidInvoice(
        'invoiceId' in body ? body.invoiceId : existing.invoiceId,
        auth.id,
      );
      const delayDays = parseDelayDays('delayDays' in body ? body.delayDays : existing.delayDays);

      data.invoiceId = invoice.id;
      data.delayDays = delayDays;
      data.projectedPaymentDate = new Date(utcDay(invoice.dueDate) + delayDays * DAY_MS);
    }

    const simulation = await prisma.simulation.update({
      where: { id: existing.id },
      data,
    });

    return NextResponse.json({ simulation });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const auth = await requireOwner(request);
    if (auth instanceof Response) return auth;

    if (!UUID_RE.test(params.simulationId)) return jsonError('Not found', 404);

    const existing = await prisma.simulation.findFirst({
      where: { id: params.simulationId, userId: auth.id },
      select: { id: true },
    });
    if (!existing) return jsonError('Not found', 404);

    await prisma.simulation.delete({ where: { id: existing.id } });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleError(error);
  }
}