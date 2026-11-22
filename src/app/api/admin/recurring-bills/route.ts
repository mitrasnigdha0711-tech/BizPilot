import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const OWNER_ROLE = 'small_video_editing_business_owner';

function toDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function resolveDay(param: string | null): string {
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) return param;
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return toDay(local);
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (user instanceof Response) return user;

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true, businessId: true },
    });
    if (!dbUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (String(dbUser.role).toLowerCase() !== OWNER_ROLE) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!dbUser.businessId) {
      return NextResponse.json({ recurringBills: [] });
    }

    const today = resolveDay(request.nextUrl.searchParams.get('date'));

    const bills = await prisma.recurringBill.findMany({
      where: { businessId: dbUser.businessId },
      orderBy: { nextDueDate: 'asc' },
    });

    const recurringBills = bills.map((b) => {
      const status = String(b.status).toLowerCase();
      const dueDay = toDay(b.nextDueDate);
      return {
        id: b.id,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
        name: b.name,
        amount: Number(b.amount.toString()),
        frequency: String(b.frequency).toLowerCase(),
        startDate: toDay(b.startDate),
        endDate: b.endDate ? toDay(b.endDate) : null,
        nextDueDate: dueDay,
        lastPaidAt: b.lastPaidAt ? b.lastPaidAt.toISOString() : null,
        status,
        isOverdue: status === 'active' && dueDay < today,
        businessId: b.businessId,
        userId: b.userId,
      };
    });

    return NextResponse.json({ recurringBills });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}