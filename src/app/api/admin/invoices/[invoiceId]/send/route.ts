
import { NextRequest, NextResponse } from 'next/server';
import { Prisma, Role, InvoiceStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { invoiceId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const owner = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, role: true, businessId: true, isActive: true },
  });
  if (!owner || !owner.isActive) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (owner.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!owner.businessId) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const invoiceId = params.invoiceId;
  if (!UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId: owner.businessId },
    include: { lineItems: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  if (invoice.status !== InvoiceStatus.DRAFT) {
    return NextResponse.json(
      { error: 'Only draft invoices can be sent' },
      { status: 409 },
    );
  }

  const hasPositiveLineItem = invoice.lineItems.some((li) => Number(li.amount) > 0);
  if (!hasPositiveLineItem || Number(invoice.amount) <= 0) {
    return NextResponse.json(
      { error: 'Add at least one line item with a positive amount before sending' },
      { status: 422 },
    );
  }

  if (invoice.dueDate.getTime() < invoice.issueDate.getTime()) {
    return NextResponse.json(
      { error: 'Please enter a valid due date on or after the issue date.' },
      { status: 422 },
    );
  }

  const requestedDay = request.nextUrl.searchParams.get('date');
  const todayDay =
    requestedDay && DAY_RE.test(requestedDay)
      ? requestedDay
      : new Date().toISOString().slice(0, 10);
  const today = dayToDate(todayDay);

  const nextStatus =
    invoice.dueDate.getTime() < today.getTime() && Number(invoice.balanceDue) > 0
      ? InvoiceStatus.OVERDUE
      : InvoiceStatus.SENT;

  try {
    const result = await prisma.invoice.updateMany({
      where: {
        id: invoice.id,
        businessId: owner.businessId,
        status: InvoiceStatus.DRAFT,
      },
      data: { status: nextStatus },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Only draft invoices can be sent' },
        { status: 409 },
      );
    }

    const updated = await prisma.invoice.findUnique({
      where: { id: invoice.id },
    });

    return NextResponse.json({ invoice: updated });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}