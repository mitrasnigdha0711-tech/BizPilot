import { NextResponse } from 'next/server';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/session';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WIRE_ROLES = ['freelance_video_editor', 'small_video_editing_business_owner'] as const;
type WireRole = (typeof WIRE_ROLES)[number];

function toPrismaRole(role: WireRole): Role {
  return role === 'SMALL_VIDEO_EDITING_BUSINESS_OWNER'
    ? Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER
    : Role.FREELANCE_VIDEO_EDITOR;
}

function toWireRole(role: Role): WireRole {
  return role === Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER
    ? 'small_video_editing_business_owner'
    : 'freelance_video_editor';
}

export async function PATCH(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const user = await requireUser(request);
  if (user instanceof Response) return user;

  const caller = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, businessId: true },
  });
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (caller.role !== Role.SMALL_VIDEO_EDITING_BUSINESS_OWNER) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!caller.businessId) {
    return NextResponse.json({ error: 'No business linked to this account' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;

  const roleInput = input.role;
  if (roleInput !== undefined && !(WIRE_ROLES as readonly unknown[]).includes(roleInput)) {
    return NextResponse.json(
      { error: 'role must be freelance_video_editor or small_video_editing_business_owner' },
      { status: 400 }
    );
  }

  const activeInput = input.is_active !== undefined ? input.is_active : input.isActive;
  if (activeInput !== undefined && typeof activeInput !== 'boolean') {
    return NextResponse.json({ error: 'is_active must be a boolean' }, { status: 400 });
  }

  if (roleInput === undefined && activeInput === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  const targetId = params.userId;
  if (!UUID_RE.test(targetId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const isSelf = targetId === user.id;
  if (isSelf) {
    const demotes = roleInput !== undefined && roleInput !== 'small_video_editing_business_owner';
    const deactivates = activeInput === false;
    if (demotes || deactivates) {
      return NextResponse.json(
        { error: 'The owner cannot demote or deactivate their own account' },
        { status: 400 }
      );
    }
  }

  try {
    const target = await prisma.user.findFirst({
      where: { id: targetId, businessId: caller.businessId },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const data: Prisma.UserUpdateInput = {};
    if (roleInput !== undefined) {
      data.role = toPrismaRole(roleInput as WireRole);
    }
    if (activeInput !== undefined) {
      data.isActive = activeInput;
      if (activeInput === false) {
        // Deactivation ends the member's sessions.
        data.sessionToken = null;
        data.signedOutAt = new Date();
        data.tokenVersion = { increment: 1 };
      }
    }

    const updated = await prisma.user.update({
      where: { id: targetId },
      data,
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        email: true,
        name: true,
        role: true,
        businessId: true,
        isActive: true,
        lastLoginAt: true,
        signedOutAt: true,
        passwordChangedAt: true,
      },
    });

    const safeUser = {
      id: updated.id,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      email: updated.email,
      name: updated.name,
      role: toWireRole(updated.role),
      businessId: updated.businessId,
      isActive: updated.isActive,
      lastLoginAt: updated.lastLoginAt,
      signedOutAt: updated.signedOutAt,
      passwordChangedAt: updated.passwordChangedAt,
    };

    return NextResponse.json({ user: safeUser });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}