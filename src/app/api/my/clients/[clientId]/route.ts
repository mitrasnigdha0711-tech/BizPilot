import { NextRequest, NextResponse } from 'next/server';
import { Prisma, ClientStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9\s\-()]+$/;

type ClientPatch = {
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  status?: ClientStatus;
};

function isFreelancer(role: string): boolean {
  return String(role).toLowerCase() === 'freelance_video_editor';
}

function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

function decimalToNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value.toString());
}

function handleError(e: unknown) {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2025') {
      return notFound();
    }
    if (e.code === 'P2003') {
      return NextResponse.json(
        { error: 'Client is still linked to other records' },
        { status: 409 },
      );
    }
  }
  console.error(e);
  return NextResponse.json({ error: 'Internal error' }, { status: 500 });
}

async function loadOwnedClient(clientId: string, userId: string) {
  if (!UUID_RE.test(clientId)) return null;
  return prisma.client.findFirst({
    where: { id: clientId, userId },
  });
}

function buildPatch(input: Record<string, unknown>): { data: ClientPatch } | { error: string } {
  const data: ClientPatch = {};

  if ('name' in input) {
    if (typeof input.name !== 'string' || input.name.trim() === '') {
      return { error: "Please enter the client's name." };
    }
    const name = input.name.trim();
    if (name.length > 120) {
      return { error: 'Client name must be 120 characters or fewer.' };
    }
    data.name = name;
  }

  if ('email' in input) {
    if (input.email === null || input.email === '') {
      data.email = null;
    } else if (typeof input.email !== 'string') {
      return { error: 'Please enter a valid email address, such as name@example.com.' };
    } else {
      const email = input.email.trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        return { error: 'Please enter a valid email address, such as name@example.com.' };
      }
      data.email = email;
    }
  }

  if ('phone' in input) {
    if (input.phone === null || input.phone === '') {
      data.phone = null;
    } else if (typeof input.phone !== 'string') {
      return { error: 'Please enter a valid phone number using digits, spaces, dashes or a leading +.' };
    } else {
      const phone = input.phone.trim();
      if (phone.length > 25 || !PHONE_RE.test(phone)) {
        return { error: 'Please enter a valid phone number using digits, spaces, dashes or a leading +.' };
      }
      data.phone = phone;
    }
  }

  if ('address' in input) {
    if (input.address === null || input.address === '') {
      data.address = null;
    } else if (typeof input.address !== 'string') {
      return { error: 'Address must be 300 characters or fewer.' };
    } else {
      const address = input.address.trim();
      if (address.length > 300) {
        return { error: 'Address must be 300 characters or fewer.' };
      }
      data.address = address;
    }
  }

  if ('status' in input) {
    if (input.status === 'active') {
      data.status = ClientStatus.ACTIVE;
    } else if (input.status === 'inactive') {
      data.status = ClientStatus.INACTIVE;
    } else {
      return { error: 'Status must be active or inactive.' };
    }
  }

  if (Object.keys(data).length === 0) {
    return { error: 'No changes provided.' };
  }

  return { data };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (!isFreelancer(user.role)) return forbidden();

  try {
    const client = await loadOwnedClient(params.clientId, user.id);
    if (!client) return notFound();

    const full = await prisma.client.findFirst({
      where: { id: client.id, userId: user.id },
      include: {
        projects: { orderBy: { deadline: 'asc' } },
        invoices: { orderBy: { issueDate: 'desc' } },
      },
    });
    if (!full) return notFound();

    const { projects, invoices, ...base } = full;

    return NextResponse.json({
      client: {
        ...base,
        projects: projects.map((p) => ({
          ...p,
          value: decimalToNumber(p.value),
        })),
        invoices: invoices.map((i) => ({
          ...i,
          amount: decimalToNumber(i.amount),
          amountPaid: decimalToNumber(i.amountPaid),
          balanceDue: decimalToNumber(i.balanceDue),
        })),
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (!isFreelancer(user.role)) return forbidden();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
  }

  const patch = buildPatch(body as Record<string, unknown>);
  if ('error' in patch) {
    return NextResponse.json({ error: patch.error }, { status: 400 });
  }

  try {
    const existing = await loadOwnedClient(params.clientId, user.id);
    if (!existing) return notFound();

    if (patch.data.email) {
      const duplicate = await prisma.client.findFirst({
        where: {
          businessId: existing.businessId,
          id: { not: existing.id },
          email: { equals: patch.data.email, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'A client with this email already exists in your business.' },
          { status: 409 },
        );
      }
    }

    const client = await prisma.client.update({
      where: { id: existing.id },
      data: patch.data,
    });

    return NextResponse.json({ client });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { clientId: string } },
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;
  if (!isFreelancer(user.role)) return forbidden();

  try {
    const client = await loadOwnedClient(params.clientId, user.id);
    if (!client) return notFound();

    const [projectCount, invoiceCount] = await Promise.all([
      prisma.project.count({ where: { clientId: client.id } }),
      prisma.invoice.count({ where: { clientId: client.id } }),
    ]);

    if (projectCount + invoiceCount > 0) {
      return NextResponse.json(
        { error: 'Client has projects or invoices. Set it to inactive instead.' },
        { status: 409 },
      );
    }

    await prisma.$transaction([
      prisma.task.updateMany({
        where: { clientId: client.id },
        data: { clientId: null },
      }),
      prisma.client.delete({ where: { id: client.id } }),
    ]);

    return NextResponse.json({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}