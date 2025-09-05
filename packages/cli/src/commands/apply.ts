import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { Manager, applyAll } from "@dot-steward/core";
import { loadState, saveState, hostKey } from "../state.ts";
import type { Command } from "commander";

function resolveConfigToFileUrl(p: string): string {
  const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  return pathToFileURL(abs).href;
}

export function registerApply(program: Command): void {
  program
    .command("apply")
    .description("Analyze, plan and apply changes")
    .option(
      "-c, --config <path>",
      "Path to config file (TS/JS)",
      "dot-steward.config.ts",
    )
    .action(async (opts: { config: string }) => {
      const mgr = new Manager();
      const cfgUrl = resolveConfigToFileUrl(opts.config);
      try {
        await mgr.init(cfgUrl);
      } catch (err) {
        console.error(
          `Failed to load config from ${opts.config}. Try --config examples/config.ts`,
        );
        if (err instanceof Error) console.error(err.message);
        process.exitCode = 1;
        return;
      }

      // Decide whether to reuse last plan
      const st = await loadState();
      const last = st.lastPlan;
      let useSavedPlan = false;
      if (
        last &&
        last.configPath === opts.config &&
        last.host.os === mgr.host.os &&
        last.host.arch === mgr.host.arch &&
        last.host.home === mgr.host.user.home
      ) {
        // Prompt: use last plan? y/N
        const rl = await import("node:readline/promises");
        const rli = rl.createInterface({ input: process.stdin, output: process.stdout });
        const ans = (await rli.question("Use last saved plan? [y/N] ")).trim().toLowerCase();
        rli.close();
        useSavedPlan = ans === "y" || ans === "yes";
      }

      let result: Awaited<ReturnType<typeof applyAll>> | null = null;
      let decisions: Awaited<ReturnType<typeof mgr.plan>> | null = null;
      if (useSavedPlan && last) {
        // Use saved plan for display; still run analyze+apply freshly
        try {
          await mgr.analyze();
        } catch (err) {
          console.error("Analyze failed before apply.");
          if (err instanceof Error) console.error(err.message);
          process.exitCode = 1;
          return;
        }
        try {
          await mgr.apply();
        } catch (err) {
          // Collect errors similar to applyAll
          const errors: Array<{ id: string; error: string }> = [];
          const isAgg = !!err && typeof err === "object" && "errors" in (err as any);
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
          // Build a pseudo-result for printing
          decisions = await mgr.plan().catch(() => [] as any);
          result = {
            plan: decisions ?? [],
            stats: {
              items: last.decisions.length,
              to_apply: last.decisions.filter((d) => d.action === "apply").length,
              skipped: last.decisions.filter((d) => d.action === "skip").length,
              noop: last.decisions.filter((d) => d.action === "noop").length,
            },
            errors,
          } as any;
        }
        if (!result) {
          // Success path: synthesize result using saved decisions; compute current plan for mapping labels
          decisions = await mgr.plan().catch(() => [] as any);
          result = {
            plan: decisions ?? [],
            stats: {
              items: last.decisions.length,
              to_apply: last.decisions.filter((d) => d.action === "apply").length,
              skipped: last.decisions.filter((d) => d.action === "skip").length,
              noop: last.decisions.filter((d) => d.action === "noop").length,
            },
            errors: [],
          } as any;
        }
      } else {
        // Execute analyze -> plan -> apply via core helper
        try {
          result = await applyAll(mgr);
        } catch (err) {
          console.error("Apply failed.");
          if (err instanceof Error) console.error(err.message);
          process.exitCode = 1;
          return;
        }
        // Save last plan for future runs
        try {
          const st2 = await loadState();
          st2.lastPlan = {
            configPath: opts.config,
            host: hostKey(mgr),
            at: new Date().toISOString(),
            decisions: (result as any).plan.map((d: any) => ({
              item_id: d.item.id,
              action: d.action,
              reason: d.reason,
              summary: d.details?.summary,
            })),
          };
          await saveState(st2);
        } catch {
          // ignore state save errors
        }
      }

      const RESET = "\x1b[0m";
      const GREEN = "\x1b[32m";
      const DIM = "\x1b[2m";
      const RED = "\x1b[31m";

      // Show summary
      const s = (result as any).stats;
      console.log(
        `Summary: to apply ${s.to_apply}, skipped ${s.skipped}, no-op ${s.noop}`,
      );
      console.log("");

      // List items intended to apply based on chosen plan (saved or current)
      const chosen = useSavedPlan && last ? last.decisions : (result as any).plan.map((d: any) => ({
        item_id: d.item.id,
        action: d.action,
        summary: d.details?.summary,
      }));
      for (const d of chosen) {
        if (d.action !== "apply") continue;
        // Try to find current item for label fallback
        const it = mgr.deps.nodes.get((d as any).item_id);
        const summary = d.summary ?? (it ? it.render() : String((d as any).item_id));
        console.log(`${GREEN}+ ${summary}${RESET}`);
      }

      // Errors (if any)
      if ((result as any).errors.length > 0) {
        console.log("");
        console.error(`${RED}Errors:${RESET}`);
        for (const e of (result as any).errors) {
          const it = e.id ? mgr.deps.nodes.get(e.id) : undefined;
          const label = it ? it.render() : e.id || "item";
          console.error(`${RED}! ${label}${RESET} ${DIM}->${RESET} ${e.error}`);
        }
        process.exitCode = 1;
      }

      // Persist lastApply details for future cleanup decisions
      try {
        const chosenApplied = (useSavedPlan && last ? last.decisions : (result as any).plan.map((d: any) => ({
          item_id: d.item.id,
          action: d.action,
          summary: d.details?.summary,
        })))
          .filter((d: any) => d.action === "apply");
        const applied = chosenApplied.map((d: any) => {
          const it = mgr.deps.nodes.get(d.item_id);
          const label = it ? it.render() : String(d.item_id);
          const kind = it ? it.kind : "item";
          return { id: d.item_id, kind, label, summary: d.summary };
        });
        const state = await loadState();
        state.lastApply = {
          configPath: opts.config,
          host: hostKey(mgr),
          at: new Date().toISOString(),
          applied,
        };
        await saveState(state);
      } catch {
        // ignore save errors
      }
    });
}
