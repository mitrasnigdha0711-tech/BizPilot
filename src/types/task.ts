// Auto-generated from prisma/schema.prisma — canonical Task shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export const PRIORITY_VALUES = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type PriorityValue = Priority;

export const TASKSTATUS_VALUES = ['OPEN', 'COMPLETED'] as const;
export type TaskStatus = 'OPEN' | 'COMPLETED';
export type TaskStatusValue = TaskStatus;

export const TASKTYPE_VALUES = ['TASK', 'FOLLOW_UP'] as const;
export type TaskType = 'TASK' | 'FOLLOW_UP';
export type TaskTypeValue = TaskType;

export interface Task {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  type: TaskType;
  status: TaskStatus;
  priority: Priority;
  priorityNote?: string | null;
  dueDate?: string | null;
  plannedWeekStart?: string | null;
  completedAt?: string | null;
  projectId?: string | null;
  clientId?: string | null;
  goalId?: string | null;
  quoteId?: string | null;
  assigneeId?: string | null;
  userId: string;
}
