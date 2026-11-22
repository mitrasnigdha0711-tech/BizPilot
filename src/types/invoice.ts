// Auto-generated from prisma/schema.prisma — canonical Invoice shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export const INVOICESTATUS_VALUES = ['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'] as const;
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
export type InvoiceStatusValue = InvoiceStatus;

export interface Invoice {
  id: string;
  createdAt: string;
  updatedAt: string;
  invoiceNumber: string;
  clientId: string;
  projectId?: string | null;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  amount: string;
  amountPaid: string;
  balanceDue: string;
  businessId: string;
  userId: string;
}
