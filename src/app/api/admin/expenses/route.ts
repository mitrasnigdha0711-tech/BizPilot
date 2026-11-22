
import { NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

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

    if (me.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!me.businessId) {
      return NextResponse.json({ expenses: [] });
    }

    const rows = await prisma.expens.findMany({
      where: { businessId: me.businessId },
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
    });

    const expenses = rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      description: row.description,
      amount: Number(row.amount),
      category: row.category,
      expenseDate: row.expenseDate.toISOString().slice(0, 10),
      projectId: row.projectId,
      businessId: row.businessId,
      userId: row.userId,
    }));

    return NextResponse.json({ expenses });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}