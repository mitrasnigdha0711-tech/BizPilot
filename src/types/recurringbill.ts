// Auto-generated from prisma/schema.prisma — canonical RecurringBill shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export const RECURRINGBILLSTATUS_VALUES = ['ACTIVE', 'PAUSED', 'ENDED'] as const;
export type RecurringBillStatus = 'ACTIVE' | 'PAUSED' | 'ENDED';
export type RecurringBillStatusValue = RecurringBillStatus;

export const RECURRINGFREQUENCY_VALUES = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const;
export type RecurringFrequency = 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type RecurringFrequencyValue = RecurringFrequency;

export interface RecurringBill {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  amount: string;
  frequency: RecurringFrequency;
  startDate: string;
  endDate?: string | null;
  nextDueDate: string;
  lastPaidAt?: string | null;
  status: RecurringBillStatus;
  businessId: string;
  userId: string;
}
