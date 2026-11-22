import { NextResponse } from 'next/server';
import { ClientStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9 ()-]+$/;

type OwnerScope = { businessId: string };

async function resolveOwnerScope(request: Request): Promise<OwnerScope | Response> {
  const sessionUser = await requireUser(request);
  if (sessionUser instanceof Response) return sessionUser;

  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { role: true, businessId: true, isActive: true },
  });

  if (!dbUser || !dbUser.isActive) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  if (dbUser.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!dbUser.businessId) {
    return NextResponse.json({ error: 'No business linked to this account' }, { status: 403 });
  }
  return { businessId: dbUser.businessId };
}

function isNotFoundError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025';
}

type ParsedClientInput =
  | { data: Prisma.ClientUpdateInput; email: string | null | undefined }
  | { error: string };

function parseClientInput(raw: Record<string, unknown>): ParsedClientInput {
  const data: Prisma.ClientUpdateInput = {};
  let email: string | null | undefined = undefined;

  if ('name' in raw) {
    const value = raw.name;
    if (typeof value !== 'string' || value.trim().length === 0) {
      return { error: "Please enter the client's name." };
    }
    const name = value.trim();
    if (name.length > 120) {
      return { error: 'Client name must be 120 characters or fewer.' };
    }
    data.name = name;
  }

  if ('email' in raw) {
    const value = raw.email;
    if (value === null || value === '' || value === undefined) {
      email = null;
    } else if (typeof value !== 'string') {
      return { error: 'Please enter a valid email address, for example name@company.com.' };
    } else {
      const normalized = value.trim().toLowerCase();
      if (normalized.length > 254 || !EMAIL_RE.test(normalized)) {
        return { error: 'Please enter a valid email address, for example name@company.com.' };
      }
      email = normalized;
    }
    data.email = email;
  }

  if ('phone' in raw) {
    const value = raw.phone;
    if (value === null || value === '' || value === undefined) {
      data.phone = null;
    } else if (typeof value !== 'string') {
      return { error: 'Please enter a valid phone number using digits, spaces, dashes or a leading +.' };
    } else {
      const phone = value.trim();
      if (phone.length > 25 || !PHONE_RE.test(phone)) {
        return { error: 'Please enter a valid phone number using digits, spaces, dashes or a leading +.' };
      }
      data.phone = phone;
    }
  }

  if ('address' in raw) {
    const value = raw.address;
    if (value === null || value === '' || value === undefined) {
      data.address = null;
    } else if (typeof value !== 'string') {
      return { error: 'Address must be 300 characters or fewer.' };
    } else {
      const address = value.trim();
      if (address.length > 300) {
        return { error: 'Address must be 300 characters or fewer.' };
      }
      data.address = address;
    }
  }

  if ('status' in raw) {
    const value = raw.status;
    if (value === 'active') {
      data.status = ClientStatus.ACTIVE;
    } else if (value === 'inactive') {
      data.status = ClientStatus.INACTIVE;
    } else {
      return { error: 'Status must be active or inactive.' };
    }
  }

  return { data, email };
}

export async function GET(
  request: Request,
  { params }: { params: { clientId: string } },
) {
  const scope = await resolveOwnerScope(request);
  if (scope instanceof Response) return scope;

  const clientId = params.clientId;
  if (!UUID_RE.test(clientId)) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  try {
    const client = await prisma.client.findFirst({
      where: { id: clientId, businessId: scope.businessId },
      include: {
        projects: { orderBy: { deadline: 'asc' } },
        invoices: { orderBy: { issueDate: 'desc' } },
      },
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ client });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { clientId: string } },
) {
  const scope = await resolveOwnerScope(request);
  if (scope instanceof Response) return scope;

  const clientId = params.clientId;
  if (!UUID_RE.test(clientId)) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
  }

  const parsed = parseClientInput(body as Record<string, unknown>);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 });
  }

  try {
    const existing = await prisma.client.findFirst({
      where: { id: clientId, businessId: scope.businessId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    if (parsed.email) {
      const duplicate = await prisma.client.findFirst({
        where: {
          businessId: scope.businessId,
          email: parsed.email,
          NOT: { id: clientId },
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
      data: parsed.data,
    });

    return NextResponse.json({ client });
  } catch (e) {
    if (isNotFoundError(e)) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { clientId: string } },
) {
  const scope = await resolveOwnerScope(request);
  if (scope instanceof Response) return scope;

  const clientId = params.clientId;
  if (!UUID_RE.test(clientId)) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  try {
    const existing = await prisma.client.findFirst({
      where: { id: clientId, businessId: scope.businessId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const [projectCount, invoiceCount, reminderCount] = await Promise.all([
      prisma.project.count({ where: { clientId: existing.id } }),
      prisma.invoice.count({ where: { clientId: existing.id } }),
      prisma.reminder.count({ where: { clientId: existing.id } }),
    ]);

    if (projectCount > 0 || invoiceCount > 0 || reminderCount > 0) {
      return NextResponse.json(
        { error: 'This client has projects or invoices and cannot be deleted. Set it to inactive instead.' },
        { status: 409 },
      );
    }

    await prisma.client.delete({ where: { id: existing.id } });

    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (isNotFoundError(e)) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}