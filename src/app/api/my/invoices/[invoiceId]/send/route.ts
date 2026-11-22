import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export async function POST(
  request: Request,
  { params }: { params: { invoiceId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (String(user.role).toLowerCase() !== 'freelance_video_editor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { invoiceId } = params;

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, userId: user.id },
      include: { lineItems: true },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (invoice.status !== 'DRAFT') {
      return NextResponse.json(
        { error: 'Only draft invoices can be sent' },
        { status: 409 },
      );
    }

    const hasPositiveLineItem = invoice.lineItems.some(
      (item) => Number(item.amount) > 0,
    );
    if (!hasPositiveLineItem || Number(invoice.amount) <= 0) {
      return NextResponse.json(
        { error: 'Add at least one line item with a positive amount before sending' },
        { status: 400 },
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const dueDay = invoice.dueDate.toISOString().slice(0, 10);
    const nextStatus =
      dueDay < today && Number(invoice.balanceDue) > 0 ? 'OVERDUE' : 'SENT';

    const result = await prisma.invoice.updateMany({
      where: { id: invoice.id, userId: user.id, status: 'DRAFT' },
      data: { status: nextStatus },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: 'Invoice was changed by another request' },
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