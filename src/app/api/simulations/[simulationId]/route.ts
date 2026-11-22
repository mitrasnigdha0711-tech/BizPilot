import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OWNER_ROLE = 'SMALL_VIDEO_EDITING_BUSINESS_OWNER';
const UNPAID_STATUSES = ['SENT', 'OVERDUE', 'PARTIALLY_PAID'];
const SCENARIO_TYPES = ['DELAYED_PAYMENT', 'CUSTOM'];

type Scope = { userId: string; businessId: string };

async function authorize(request: Request): Promise<Scope | Response> {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, role: true, businessId: true },
  });
  if (!me) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (me.role !== OWNER_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!me.businessId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return { userId: me.id, businessId: me.businessId };
}

export async function GET(
  request: Request,
  { params }: { params: { simulationId: string } }
) {
  const scope = await authorize(request);
  if (scope instanceof Response) return scope;

  const { simulationId } = params;
  if (!UUID_RE.test(simulationId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const simulation = await prisma.simulation.findFirst({
      where: { id: simulationId, userId: scope.userId, businessId: scope.businessId },
    });
    if (!simulation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ simulation });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { simulationId: string } }
) {
  const scope = await authorize(request);
  if (scope instanceof Response) return scope;

  const { simulationId } = params;
  if (!UUID_RE.test(simulationId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const existing = await prisma.simulation.findFirst({
      where: { id: simulationId, userId: scope.userId, businessId: scope.businessId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (existing.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'A completed simulation cannot be changed' },
        { status: 409 }
      );
    }

    const data: Prisma.SimulationUpdateInput = {};
    let scenarioChanged = false;

    // name: optional label, up to 80 characters
    if (body.name !== undefined) {
      if (typeof body.name !== 'string') {
        return NextResponse.json({ error: 'Simulation name must be text.' }, { status: 400 });
      }
      const name = body.name.trim();
      if (name.length > 80) {
        return NextResponse.json(
          { error: 'Simulation name must be 80 characters or fewer.' },
          { status: 400 }
        );
      }
      if (name.length === 0) {
        return NextResponse.json({ error: 'Simulation name is required.' }, { status: 400 });
      }
      data.name = name;
    }

    // scenarioType
    if (body.scenarioType !== undefined) {
      if (typeof body.scenarioType !== 'string' || !SCENARIO_TYPES.includes(body.scenarioType)) {
        return NextResponse.json(
          { error: 'Please choose a scenario to simulate.' },
          { status: 400 }
        );
      }
      data.scenarioType = body.scenarioType as 'DELAYED_PAYMENT' | 'CUSTOM';
      scenarioChanged = true;
    }

    // delayDays: whole number 1..180
    if (body.delayDays !== undefined) {
      const raw = body.delayDays;
      if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        return NextResponse.json(
          { error: 'Enter a whole number of delay days between 1 and 180.' },
          { status: 400 }
        );
      }
      if (!Number.isInteger(raw)) {
        return NextResponse.json(
          { error: 'Delay days must be a whole number, such as 14 or 30.' },
          { status: 400 }
        );
      }
      if (raw < 1 || raw > 180) {
        return NextResponse.json(
          { error: 'Enter a whole number of delay days between 1 and 180.' },
          { status: 400 }
        );
      }
      data.delayDays = raw;
      scenarioChanged = true;
    }

    // invoiceId: must be an unpaid invoice of this user's business
    let invoiceDue: Date | null = null;
    if (body.invoiceId !== undefined) {
      if (body.invoiceId === null) {
        data.invoice = { disconnect: true };
        data.projectedPaymentDate = null;
        scenarioChanged = true;
      } else {
        if (typeof body.invoiceId !== 'string' || !UUID_RE.test(body.invoiceId)) {
          return NextResponse.json(
            { error: 'Please select an unpaid invoice for this simulation.' },
            { status: 400 }
          );
        }
        const invoice = await prisma.invoice.findFirst({
          where: {
            id: body.invoiceId,
            businessId: scope.businessId,
            userId: scope.userId,
          },
          select: { id: true, status: true, balanceDue: true, dueDate: true },
        });
        if (
          !invoice ||
          !UNPAID_STATUSES.includes(invoice.status) ||
          Number(invoice.balanceDue) <= 0
        ) {
          return NextResponse.json(
            { error: 'Please select an unpaid invoice for this simulation.' },
            { status: 400 }
          );
        }
        invoiceDue = invoice.dueDate;
        data.invoice = { connect: { id: invoice.id } };
        scenarioChanged = true;
      }
    }

    // Resulting scenario must still be complete for a delayed payment.
    const finalScenario = data.scenarioType ?? existing.scenarioType;
    if (finalScenario === 'DELAYED_PAYMENT') {
      const finalInvoiceId =
        body.invoiceId === null
          ? null
          : typeof body.invoiceId === 'string'
            ? body.invoiceId
            : existing.invoiceId;
      const finalDelay =
        data.delayDays !== undefined ? (data.delayDays as number) : existing.delayDays;
      if (!finalInvoiceId) {
        return NextResponse.json(
          { error: 'Please select an unpaid invoice for this simulation.' },
          { status: 400 }
        );
      }
      if (finalDelay === null || finalDelay === undefined) {
        return NextResponse.json(
          { error: 'Enter a whole number of delay days between 1 and 180.' },
          { status: 400 }
        );
      }
      // Recompute projected payment date from the invoice due date when scenario inputs change.
      if (scenarioChanged) {
        let dueDate = invoiceDue;
        if (!dueDate) {
          const inv = await prisma.invoice.findFirst({
            where: { id: finalInvoiceId, businessId: scope.businessId, userId: scope.userId },
            select: { dueDate: true },
          });
          dueDate = inv?.dueDate ?? null;
        }
        if (dueDate) {
          const projected = new Date(dueDate);
          projected.setUTCDate(projected.getUTCDate() + finalDelay);
          data.projectedPaymentDate = projected;
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ simulation: existing });
    }

    const simulation = await prisma.simulation.update({
      where: { id: simulationId },
      data,
    });
    return NextResponse.json({ simulation });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { simulationId: string } }
) {
  const scope = await authorize(request);
  if (scope instanceof Response) return scope;

  const { simulationId } = params;
  if (!UUID_RE.test(simulationId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const existing = await prisma.simulation.findFirst({
      where: { id: simulationId, userId: scope.userId, businessId: scope.businessId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    await prisma.simulation.delete({ where: { id: simulationId } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}