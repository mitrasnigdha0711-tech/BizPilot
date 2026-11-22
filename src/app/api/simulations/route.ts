import { NextResponse } from 'next/server';
import {
  InvoiceStatus,
  Role,
  SimulationScenarioType,
  SimulationStatus,
} from '@prisma/client';
import type { Simulation } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME_MAX = 80;
const DELAY_MIN = 1;
const DELAY_MAX = 180;
const UNPAID_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.OVERDUE,
  InvoiceStatus.PARTIALLY_PAID,
];

const SCENARIO_MAP: Record<string, SimulationScenarioType> = {
  delayed_payment: SimulationScenarioType.DELAYED_PAYMENT,
  custom: SimulationScenarioType.CUSTOM,
};

function toJson(s: Simulation) {
  return {
    id: s.id,
    name: s.name,
    scenarioType: s.scenarioType,
    delayDays: s.delayDays,
    invoiceId: s.invoiceId,
    projectedPaymentDate: s.projectedPaymentDate
      ? s.projectedPaymentDate.toISOString().slice(0, 10)
      : null,
    status: s.status,
    businessId: s.businessId,
    userId: s.userId,
    projectedBalance: s.projectedBalance === null ? null : Number(s.projectedBalance),
    shortfallAmount: s.shortfallAmount === null ? null : Number(s.shortfallAmount),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const sessionUser = await requireUser(request);
  if (sessionUser instanceof Response) return sessionUser;

  try {
    const owner = await prisma.user.findUnique({ where: { id: sessionUser.id } });
    if (!owner || owner.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
      return NextResponse.json({ error: 'Not available for your role' }, { status: 403 });
    }
    if (!owner.businessId) {
      return NextResponse.json({ simulations: [] });
    }

    const rows = await prisma.simulation.findMany({
      where: { userId: owner.id, businessId: owner.businessId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ simulations: rows.map(toJson) });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const sessionUser = await requireUser(request);
  if (sessionUser instanceof Response) return sessionUser;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const input = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;

  try {
    const owner = await prisma.user.findUnique({ where: { id: sessionUser.id } });
    if (!owner || owner.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
      return NextResponse.json({ error: 'Not available for your role' }, { status: 403 });
    }
    if (!owner.businessId) {
      return NextResponse.json({ error: 'Set up your business first' }, { status: 400 });
    }

    const scenarioKey = typeof input.scenarioType === 'string' ? input.scenarioType : '';
    const scenarioType = SCENARIO_MAP[scenarioKey];
    if (!scenarioType) {
      return NextResponse.json(
        { error: 'Please choose a scenario to simulate.' },
        { status: 400 },
      );
    }

    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (name.length > NAME_MAX) {
      return NextResponse.json(
        { error: 'Simulation name must be 80 characters or fewer.' },
        { status: 400 },
      );
    }

    if (scenarioType === SimulationScenarioType.CUSTOM) {
      if (!name) {
        return NextResponse.json({ error: 'Please give this simulation a name.' }, { status: 400 });
      }
      const created = await prisma.simulation.create({
        data: {
          name,
          scenarioType,
          status: SimulationStatus.DRAFT,
          businessId: owner.businessId,
          userId: owner.id,
        },
      });
      return NextResponse.json({ simulation: toJson(created) }, { status: 201 });
    }

    // Delayed payment scenario
    const invoiceId = typeof input.invoiceId === 'string' ? input.invoiceId : '';
    const unpaidMessage = 'Please select an unpaid invoice for this simulation.';
    if (!UUID_RE.test(invoiceId)) {
      return NextResponse.json({ error: unpaidMessage }, { status: 400 });
    }

    const rawDelay =
      typeof input.delayDays === 'string' ? Number(input.delayDays.trim()) : input.delayDays;
    if (typeof rawDelay !== 'number' || !Number.isInteger(rawDelay)) {
      return NextResponse.json(
        { error: 'Delay days must be a whole number, such as 14 or 30.' },
        { status: 400 },
      );
    }
    if (rawDelay < DELAY_MIN || rawDelay > DELAY_MAX) {
      return NextResponse.json(
        { error: 'Enter a whole number of delay days between 1 and 180.' },
        { status: 400 },
      );
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, userId: owner.id, businessId: owner.businessId },
    });
    if (
      !invoice ||
      !UNPAID_STATUSES.includes(invoice.status) ||
      Number(invoice.balanceDue) <= 0
    ) {
      return NextResponse.json({ error: unpaidMessage }, { status: 400 });
    }

    const due = invoice.dueDate;
    const projectedPaymentDate = new Date(
      Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate() + rawDelay),
    );

    const label = (name || `Delayed payment: ${invoice.invoiceNumber}`).slice(0, NAME_MAX);

    const created = await prisma.simulation.create({
      data: {
        name: label,
        scenarioType,
        delayDays: rawDelay,
        invoiceId: invoice.id,
        projectedPaymentDate,
        status: SimulationStatus.DRAFT,
        businessId: owner.businessId,
        userId: owner.id,
      },
    });

    return NextResponse.json({ simulation: toJson(created) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}