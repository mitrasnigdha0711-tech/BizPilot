// Auto-generated from prisma/schema.prisma — canonical User shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export const ROLE_VALUES = ['FREELANCE_VIDEO_EDITOR', 'SMALL_VIDEO_EDITING_BUSINESS_OWNER'] as const;
export type Role = 'FREELANCE_VIDEO_EDITOR' | 'SMALL_VIDEO_EDITING_BUSINESS_OWNER';
export type RoleValue = Role;

export interface User {
  id: string;
  createdAt: string;
  updatedAt: string;
  email: string;
  name: string;
  role: Role;
  businessId?: string | null;
  isActive: boolean;
  failedLoginCount: number;
  lockedUntil?: string | null;
  lastLoginAt?: string | null;
  sessionToken?: string | null;
  signedOutAt?: string | null;
  passwordChangedAt?: string | null;
  passwordResetToken?: string | null;
  passwordResetTokenHash?: string | null;
  passwordResetExpiresAt?: string | null;
  tokenVersion: number;
}
