// Diffing
export interface Change {
  path: string;
  from?: unknown;
  to?: unknown;
}

export interface Diff<TCurrent = unknown, TDesired = unknown> {
  current: TCurrent | null;
  desired: TDesired;
  changes?: Change[] | Record<string, unknown>;
  idempotent: boolean;
}
