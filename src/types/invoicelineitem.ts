// Auto-generated from prisma/schema.prisma — canonical InvoiceLineItem shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export interface InvoiceLineItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  invoiceId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  amount: string;
}
