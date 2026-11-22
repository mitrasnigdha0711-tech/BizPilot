import { NextResponse } from 'next/server';
import { InvoiceStatus, SimulationScenarioType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const OWNER_ROLE = 'small_video_editing_business_owner';
const NAME_MAX_LENGTH = 80;
const DELAY_MIN = 1;
const DELAY_MAX = 180;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNPAID_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

const MSG_SCENARIO = 'Please choose a scenario to simulate.';
const MSG_UNPAID_INVOICE = 'Please select an unpaid invoice for this simulation.';
const MSG_DELAY_RANGE = 'Enter a whole number of delay days between 1 and 180.';
const MSG_DELAY_WHOLE = 'Delay days must be a whole number, such as 14 or 30.';
const MSG_NAME_LENGTH = 'Simulation name must be 80 characters or fewer.';

function isOwnerRole(role: unknown): boolean {
  return typeof role === 'string' && role.toLowerCase() === OWNER_ROLE;
}

async function loadCaller(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, businessId: true },
  });
}

function parseDelayDays(raw: unknown): { ok: true; value: number } | { ok: false; error: string } {
  const value =
    typeof raw === 'string' && raw.trim() !== '' ? Number(raw.trim()) : raw;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, error: MSG_DELAY_RANGE };
  }
  if (!Number.isInteger(value)) {
    return { ok: false, error: MSG_DELAY_WHOLE };
  }
  if (value < DELAY_MIN || value > DELAY_MAX) {
    return { ok: false, error: MSG_DELAY_RANGE };
  }
  return { ok: true, value };
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  try {
    const caller = await loadCaller(user.id);
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isOwnerRole(caller.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!caller.businessId) {
      return NextResponse.json({ simulations: [] });
    }

    const simulations = await prisma.simulation.findMany({
      where: { userId: caller.id, businessId: caller.businessId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ simulations });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const caller = await loadCaller(user.id);
    if (!caller) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isOwnerRole(caller.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!caller.businessId) {
      return NextResponse.json(
        { error: 'Set up your business before creating simulations' },
        { status: 409 },
      );
    }
    const businessId = caller.businessId;

    // Scenario type must be chosen.
    const rawScenario =
      typeof body.scenarioType === 'string' ? body.scenarioType.trim().toLowerCase() : '';
    if (rawScenario !== 'delayed_payment' && rawScenario !== 'custom') {
      return NextResponse.json({ error: MSG_SCENARIO }, { status: 400 });
    }

    // Optional label, max 80 characters.
    let name: string | null = null;
    if (body.name !== undefined && body.name !== null) {
      if (typeof body.name !== 'string') {
        return NextResponse.json({ error: MSG_NAME_LENGTH }, { status: 400 });
      }
      const trimmed = body.name.trim();
      if (trimmed.length > NAME_MAX_LENGTH) {
        return NextResponse.json({ error: MSG_NAME_LENGTH }, { status: 400 });
      }
      name = trimmed.length > 0 ? trimmed : null;
    }

    if (rawScenario === 'custom') {
      if (!name) {
        return NextResponse.json({ error: 'Please name this simulation.' }, { status: 400 });
      }
      const simulation = await prisma.simulation.create({
        data: {
          name,
          scenarioType: SimulationScenarioType.CUSTOM,
          businessId,
          userId: caller.id,
        },
      });
      return NextResponse.json({ simulation }, { status: 201 });
    }

    // Delayed payment scenario.
    const invoiceId = typeof body.invoiceId === 'string' ? body.invoiceId.trim() : '';
    if (!UUID_PATTERN.test(invoiceId)) {
      return NextResponse.json({ error: MSG_UNPAID_INVOICE }, { status: 400 });
    }

    const delay = parseDelayDays(body.delayDays);
    if (!delay.ok) {
      return NextResponse.json({ error: delay.error }, { status: 400 });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, userId: caller.id, businessId },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        balanceDue: true,
        dueDate: true,
      },
    });

    if (
      !invoice ||
      !UNPAID_STATUSES.includes(invoice.status) ||
      Number(invoice.balanceDue) <= 0
    ) {
      return NextResponse.json({ error: MSG_UNPAID_INVOICE }, { status: 400 });
    }

    // Projected date = invoice due date + delay days. The real invoice is never changed.
    const projectedPaymentDate = new Date(invoice.dueDate);
    projectedPaymentDate.setUTCDate(projectedPaymentDate.getUTCDate() + delay.value);

    const simulation = await prisma.simulation.create({
      data: {
        name: name ?? `Delayed payment: ${invoice.invoiceNumber}`.slice(0, NAME_MAX_LENGTH),
        scenarioType: SimulationScenarioType.DELAYED_PAYMENT,
        delayDays: delay.value,
        invoiceId: invoice.id,
        projectedPaymentDate,
        businessId,
        userId: caller.id,
      },
    });

    return NextResponse.json({ simulation }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}