import type { Manager } from "./manager.ts";

export type ApplyStats = {
  items: number;
  to_apply: number;
  skipped: number;
  noop: number;
};

export type ApplyError = { id: string; error: string };

export type ApplyResult = {
  plan: Awaited<ReturnType<Manager["plan"]>>;
  stats: ApplyStats;
  errors: ApplyError[];
};

export async function applyAll(mgr: Manager): Promise<ApplyResult> {
  // Compute plan to get decisions and counts
  const decisions = await mgr.plan();
  const stats: ApplyStats = {
    items: decisions.length,
    to_apply: decisions.filter((d) => d.action === "apply").length,
    skipped: decisions.filter((d) => d.action === "skip").length,
    noop: decisions.filter((d) => d.action === "noop").length,
  };
  const errors: ApplyError[] = [];
  try {
    await mgr.apply();
  } catch (err) {
    // Manager.apply throws AggregateError with .errors[] containing Error instances.
    const isAgg =
      !!err &&
      typeof err === "object" &&
      "errors" in (err as Record<string, unknown>);
    if (isAgg) {
      const subs = (err as unknown as AggregateError).errors ?? [];
      for (const se of subs) {
        const msg = se instanceof Error ? se.message : String(se);
        const m = msg.match(/^([0-9a-fA-F-]{36}):\s*(.*)$/);
        const id = m?.[1] ?? "";
        const detail = m?.[2] ?? msg;
        errors.push({ id, error: detail });
      }
    } else if (err instanceof Error) {
      errors.push({ id: "", error: err.message });
    } else {
      errors.push({ id: "", error: String(err) });
    }
  }
  return { plan: decisions, stats, errors };
}
