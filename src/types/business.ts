// Auto-generated from prisma/schema.prisma — canonical Business shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export const BUSINESSTYPE_VALUES = ['FREELANCE', 'SMALL_BUSINESS'] as const;
export type BusinessType = 'FREELANCE' | 'SMALL_BUSINESS';
export type BusinessTypeValue = BusinessType;

export interface Business {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  businessType: BusinessType;
  services: Record<string, unknown>;
  monthlyProjectTarget: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  currency: string;
  userId: string;
}
