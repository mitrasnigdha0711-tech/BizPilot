// Auto-generated from prisma/schema.prisma — canonical Simulation shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export const SIMULATIONSCENARIOTYPE_VALUES = ['DELAYED_PAYMENT', 'CUSTOM'] as const;
export type SimulationScenarioType = 'DELAYED_PAYMENT' | 'CUSTOM';
export type SimulationScenarioTypeValue = SimulationScenarioType;

export const SIMULATIONSTATUS_VALUES = ['DRAFT', 'COMPLETED'] as const;
export type SimulationStatus = 'DRAFT' | 'COMPLETED';
export type SimulationStatusValue = SimulationStatus;

export interface Simulation {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  scenarioType: SimulationScenarioType;
  delayDays?: number | null;
  invoiceId?: string | null;
  projectedPaymentDate?: string | null;
  status: SimulationStatus;
  businessId: string;
  userId: string;
  projectedBalance?: string | null;
  shortfallAmount?: string | null;
}
