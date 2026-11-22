// Auto-generated from prisma/schema.prisma — canonical HealthScore shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export interface HealthScore {
  id: string;
  createdAt: string;
  updatedAt: string;
  overallScore: number;
  projectConsistencyScore: number;
  paymentCollectionScore: number;
  cashflowStabilityScore: number;
  workloadScore: number;
  expenseManagementScore: number;
  generatedAt: string;
  businessId: string;
  userId: string;
  dragFactors?: Record<string, unknown> | null;
}
