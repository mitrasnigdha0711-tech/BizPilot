// Auto-generated from prisma/schema.prisma — canonical Goal shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export const GOALSTATUS_VALUES = ['ACTIVE', 'ACHIEVED', 'MISSED'] as const;
export type GoalStatus = 'ACTIVE' | 'ACHIEVED' | 'MISSED';
export type GoalStatusValue = GoalStatus;

export interface Goal {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  targetProjectCount: number;
  completedCount: number;
  status: GoalStatus;
  businessId: string;
  userId: string;
}
