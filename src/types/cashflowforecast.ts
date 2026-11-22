// Auto-generated from prisma/schema.prisma — canonical CashflowForecast shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export interface CashflowForecast {
  id: string;
  createdAt: string;
  updatedAt: string;
  horizonDays: number;
  projectedInflow: string;
  projectedOutflow: string;
  netCashflow: string;
  baselineBalance?: string | null;
  projectedBalance?: string | null;
  shortfallAmount: string;
  generatedAt: string;
  businessId: string;
  userId: string;
}
