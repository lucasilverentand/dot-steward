import type { ApplyReport, ApplyResult, Plan } from "@dot-steward/types";
import { PluginRegistry } from "../plugins";
import { detectHostFacts } from "../host";

export interface ApplyOptions {
  concurrency?: number;
}

export class ApplyPhase {
  constructor(private readonly plugins?: PluginRegistry) {}

  async executePlan(
    plan: Plan,
    _opts: ApplyOptions = {},
  ): Promise<ApplyReport> {
    type BunLike = { nanoseconds?: () => number | bigint };
    const bun = (globalThis as unknown as { Bun?: BunLike }).Bun;
    const startNs: number | bigint = bun?.nanoseconds
      ? bun.nanoseconds()
      : Date.now() * 1e6;
    const results: ApplyResult[] = [];
    const host = detectHostFacts();
    const ctx = { host, env: host.env };
    for (const n of plan.nodes) {
      const startedAt = new Date().toISOString();
      try {
        if (
          !n.pluginId ||
          (Array.isArray(n.diff?.changes) && n.diff?.changes?.length === 0)
        ) {
          results.push({
            nodeId: n.id,
            status: "skipped",
            startedAt,
            finishedAt: new Date().toISOString(),
          });
          continue;
        }
        const plugin = this.plugins?.get(n.pluginId);
        if (!plugin) {
          results.push({
            nodeId: n.id,
            status: "failed",
            error: `Plugin '${n.pluginId}' not loaded`,
            startedAt,
            finishedAt: new Date().toISOString(),
          });
          continue;
        }
        const cap = n.capabilityId;
        const handlers = cap ? plugin.capabilityHandlers?.[cap] : undefined;
        const action = handlers?.action ?? plugin.handlers.action;
        if (!action) {
          results.push({
            nodeId: n.id,
            status: "skipped",
            startedAt,
            finishedAt: new Date().toISOString(),
          });
          continue;
        }
        await Promise.resolve(action(n, ctx));
        results.push({
          nodeId: n.id,
          status: "ok",
          startedAt,
          finishedAt: new Date().toISOString(),
        });
      } catch (e) {
        results.push({
          nodeId: n.id,
          status: "failed",
          error: e instanceof Error ? e.message : String(e),
          startedAt,
          finishedAt: new Date().toISOString(),
        });
      }
    }
    const endNs: number | bigint = bun?.nanoseconds
      ? bun.nanoseconds()
      : Date.now() * 1e6;
    const toMs = (ns: number | bigint) =>
      typeof ns === "bigint"
        ? Number(ns / 1_000_000n)
        : Math.round(ns / 1_000_000);
    const diffNs: number | bigint =
      typeof endNs === "bigint" && typeof startNs === "bigint"
        ? (endNs as bigint) - (startNs as bigint)
        : (Number(endNs) - Number(startNs)) * 1e6;
    const totalMs = toMs(diffNs);
    return {
      progress: 1,
      timings: { totalMs },
      results,
      log: [
        {
          ts: new Date().toISOString(),
          level: "info",
          message: `Executed ${plan.nodes.length} actions`,
        },
      ],
    };
  }
}
