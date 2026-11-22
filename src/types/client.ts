// Auto-generated from prisma/schema.prisma — canonical Client shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export const CLIENTSTATUS_VALUES = ['ACTIVE', 'INACTIVE'] as const;
export type ClientStatus = 'ACTIVE' | 'INACTIVE';
export type ClientStatusValue = ClientStatus;

export interface Client {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  status: ClientStatus;
  businessId: string;
  userId: string;
}
