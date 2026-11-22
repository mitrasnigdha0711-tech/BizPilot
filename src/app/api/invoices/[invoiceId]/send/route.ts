import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function dayAsDate(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

function toWireInvoice(inv: {
  amount: Prisma.Decimal;
  amountPaid: Prisma.Decimal;
  balanceDue: Prisma.Decimal;
} & Record<string, unknown>) {
  return {
    ...inv,
    amount: Number(inv.amount),
    amountPaid: Number(inv.amountPaid),
    balanceDue: Number(inv.balanceDue),
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const invoiceId = params.invoiceId;
  if (!UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, businessId: true, isActive: true },
    });
    if (!dbUser || !dbUser.isActive) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    const isOwner = dbUser.role === 'SMALL_VIDEO_EDITING_BUSINESS_OWNER';
    const isFreelancer = dbUser.role === 'FREELANCE_VIDEO_EDITOR';
    if (!isOwner && !isFreelancer) {
      return NextResponse.json({ error: 'Not available for your role' }, { status: 403 });
    }

    if (isOwner && !dbUser.businessId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const scope = isOwner ? { businessId: dbUser.businessId as string } : { userId: dbUser.id };

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, ...scope },
      include: { lineItems: { select: { amount: true } } },
    });
    if (!invoice) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (invoice.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft invoices can be sent' },
        { status: 409 }
      );
    }

    const hasPositiveLine = invoice.lineItems.some((li) => Number(li.amount) > 0);
    if (!hasPositiveLine || Number(invoice.amount) <= 0) {
      return NextResponse.json(
        { error: 'Add at least one line item with a positive amount before sending' },
        { status: 400 }
      );
    }

    if (invoice.dueDate < invoice.issueDate) {
      return NextResponse.json(
        { error: 'Please enter a valid due date on or after the issue date.' },
        { status: 400 }
      );
    }

    const dayParam = request.nextUrl.searchParams.get('date');
    const today = dayAsDate(
      dayParam && DAY_RE.test(dayParam) ? dayParam : new Date().toLocaleDateString('en-CA')
    );

    const balance = Number(invoice.balanceDue);
    const nextStatus: 'SENT' | 'OVERDUE' =
      invoice.dueDate < today && balance > 0 ? 'OVERDUE' : 'SENT';

    const result = await prisma.invoice.updateMany({
      where: { id: invoice.id, status: 'DRAFT', ...scope },
      data: { status: nextStatus },
    });
    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Only draft invoices can be sent' },
        { status: 409 }
      );
    }

    const updated = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ invoice: toWireInvoice(updated) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}