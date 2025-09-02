import type { RiskLevel, RollbackPolicy } from "./actions";
import type { Diff } from "./diff";
import type { ManagedItemId, NodeId, PlanHash } from "./ids";

// Plan format
export interface PlanHeader {
  createdAt: string; // ISO timestamp
  engine?: { name: string; version: string };
  profiles?: string[];
  description?: string;
}

export interface ActionNode<TDiff = Diff> {
  id: NodeId;
  itemId: ManagedItemId;
  pluginId?: string;
  capabilityId?: string;
  action: string;
  diff: TDiff;
  locks?: string[];
  rollback?: RollbackPolicy;
  risk?: RiskLevel;
  metadata?: Record<string, unknown>;
}

export type PlanEdgeType = "dep" | "lock";

export interface PlanEdge {
  from: NodeId;
  to: NodeId;
  type: PlanEdgeType;
}

export interface Plan<TNode extends ActionNode = ActionNode> {
  header: PlanHeader;
  nodes: TNode[];
  edges: PlanEdge[];
  previews?: Diff[];
  hash: PlanHash;
}

// Useful aliases
export type PlanNode<TDiff = Diff> = ActionNode<TDiff>;
export type PlanDiff = Diff;
