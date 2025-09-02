import type { ManagedItemId, NodeId } from "./ids";

// Reports
export type Severity = "info" | "warning" | "error";

export interface AnalyzeIssue {
  code: string;
  message: string;
  severity?: Severity;
  itemId?: ManagedItemId;
  path?: string;
  context?: Record<string, unknown>;
}

export interface AnalyzeReport {
  errors: AnalyzeIssue[];
  conflicts: AnalyzeIssue[];
  lints: AnalyzeIssue[];
}

export type ApplyStatus = "ok" | "skipped" | "failed";

export interface ApplyResult {
  nodeId: NodeId;
  status: ApplyStatus;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
  retries?: number;
}

export interface ApplyReport {
  progress: number; // 0..1
  timings: { totalMs: number };
  results: ApplyResult[];
  log?: Array<{
    ts: string;
    level: "info" | "warn" | "error";
    message: string;
    context?: Record<string, unknown>;
  }>;
}
