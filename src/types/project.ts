// Auto-generated from prisma/schema.prisma — canonical Project shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export const PROJECTSTATUS_VALUES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type ProjectStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type ProjectStatusValue = ProjectStatus;

export interface Project {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  clientId: string;
  status: ProjectStatus;
  startDate?: string | null;
  deadline: string;
  value?: string | null;
  completedAt?: string | null;
  businessId: string;
  userId: string;
}
