// Auto-generated from prisma/schema.prisma — canonical Insight shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export const INSIGHTSOURCE_VALUES = ['AI', 'SYSTEM'] as const;
export type InsightSource = 'AI' | 'SYSTEM';
export type InsightSourceValue = InsightSource;

export const INSIGHTSTATUS_VALUES = ['OPEN', 'DISMISSED', 'DONE'] as const;
export type InsightStatus = 'OPEN' | 'DISMISSED' | 'DONE';
export type InsightStatusValue = InsightStatus;

export const INSIGHTTYPE_VALUES = ['BUSINESS_ADVICE', 'GROWTH_INSIGHT', 'ALERT', 'NEXT_ACTION'] as const;
export type InsightType = 'BUSINESS_ADVICE' | 'GROWTH_INSIGHT' | 'ALERT' | 'NEXT_ACTION';
export type InsightTypeValue = InsightType;

export const PRIORITY_VALUES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type PriorityValue = Priority;

export interface Insight {
  id: string;
  createdAt: string;
  updatedAt: string;
  type: InsightType;
  title: string;
  body: string;
  recommendedAction?: string | null;
  priority: Priority;
  status: InsightStatus;
  source: InsightSource;
  isAlert: boolean;
  isStale: boolean;
  dueDate?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  generatedAt: string;
  expiresAt?: string | null;
  dismissedAt?: string | null;
  invoiceId?: string | null;
  projectId?: string | null;
  businessId: string;
  userId: string;
}
