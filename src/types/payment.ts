// Auto-generated from prisma/schema.prisma — canonical Payment shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export const PAYMENTSTATUS_VALUES = ['EXPECTED', 'RECEIVED'] as const;
export type PaymentStatus = 'EXPECTED' | 'RECEIVED';
export type PaymentStatusValue = PaymentStatus;

export interface Payment {
  id: string;
  createdAt: string;
  updatedAt: string;
  invoiceId: string;
  clientId: string;
  amount: string;
  status: PaymentStatus;
  expectedDate?: string | null;
  receivedAt?: string | null;
  userId: string;
}
