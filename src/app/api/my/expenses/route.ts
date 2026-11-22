import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLE = 'freelance_video_editor';

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  if (user.role !== ALLOWED_ROLE) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const rows = await prisma.expens.findMany({
      where: { userId: user.id },
      orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
    });

    const expenses = rows.map((e) => ({
      id: e.id,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
      description: e.description,
      amount: Number(e.amount),
      category: e.category,
      expenseDate: e.expenseDate.toISOString().slice(0, 10),
      projectId: e.projectId ?? null,
      businessId: e.businessId,
      userId: e.userId,
    }));

    return NextResponse.json({ expenses });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}