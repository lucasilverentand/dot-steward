// Actions and rollback
export type RiskLevel = "low" | "medium" | "high";

export interface ActionSpec {
  action: string;
  params?: Record<string, unknown>;
}

export interface RollbackPolicy {
  strategy: "none" | "best-effort" | "compensate";
  steps?: ActionSpec[];
}
