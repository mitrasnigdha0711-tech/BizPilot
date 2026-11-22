// Auto-generated from the reviewed schema — canonical Expens shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export interface Expens {
  id: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  amount: number;
  category: string;
  expenseDate: string;
  projectId?: string | null;
  businessId: string;
  userId: string;
}
