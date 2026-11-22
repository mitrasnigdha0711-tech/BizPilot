// Auto-generated from prisma/schema.prisma — canonical Reminder shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export const REMINDERSTATUS_VALUES = ['DRAFT', 'APPROVED', 'SENT'] as const;
export type ReminderStatus = 'DRAFT' | 'APPROVED' | 'SENT';
export type ReminderStatusValue = ReminderStatus;

export const REMINDERTONE_VALUES = ['FRIENDLY', 'FIRM', 'FINAL'] as const;
export type ReminderTone = 'FRIENDLY' | 'FIRM' | 'FINAL';
export type ReminderToneValue = ReminderTone;

export interface Reminder {
  id: string;
  createdAt: string;
  updatedAt: string;
  invoiceId: string;
  clientId: string;
  subject: string;
  body: string;
  tone: ReminderTone;
  status: ReminderStatus;
  isUserEdited: boolean;
  editedAt?: string | null;
  approvedAt?: string | null;
  sentAt?: string | null;
  userId: string;
}
