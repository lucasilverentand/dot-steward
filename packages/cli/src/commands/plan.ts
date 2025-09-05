import { Manager } from "@dot-steward/core";
import type { Command } from "commander";
import { decisionsToSaved, hostKey, loadState, saveState } from "../state.ts";
import logger from "../utils/logger.ts";
import { renderPanelSections } from "../utils/ui.ts";
import { buildPlanSections } from "../utils/planSections.ts";
import { renderTreeSubsections } from "../utils/planTree.ts";
import resolveConfigToFileUrl from "../utils/config.ts";
import { appendSummaryToPanel, buildLegendLine, buildSummaryLine, computeSummaryFromDecisions } from "../utils/summary.ts";
import { collectAggregateErrors } from "../utils/errors.ts";
import pc from "picocolors";
import { buildHostPanelLines } from "../utils/host.ts";
// Removed table renderer for host details; we'll print a simple vertical list

export function registerPlan(program: Command): void {
  program
    .command("plan")
    .description("Preview actions to be taken (no changes)")
    .option(
      "-c, --config <path>",
      "Path to config file (TS/JS)",
      "dot-steward.config.ts",
    )
    .action(async (opts: { config: string }) => {
      const mgr = new Manager();
      const cfgUrl = resolveConfigToFileUrl(opts.config);

      // (probe progress logs removed for cleaner output)

      try {
        await mgr.init(cfgUrl);
      } catch (err) {
        logger.error(
          `Failed to load config from ${opts.config}. Try --config examples/config.ts`,
        );
        if (err instanceof Error) logger.error(err.message);
        process.exitCode = 1;
        return;
      }

      // Compute plan decisions
      let decisions: Awaited<ReturnType<typeof mgr.plan>>;
      try {
        decisions = await mgr.plan();
      } catch (err) {
        logger.error("Plan failed during validation.");
        const parsed = collectAggregateErrors(err);
        if (parsed.length > 0) {
          for (const e of parsed) {
            const it = e.id ? mgr.deps.nodes.get(e.id) : undefined;
            const label = it ? it.render() : e.id || "item";
            logger.error(`${pc.red("!")} ${label} ${pc.dim("->")} ${e.error}`);
          }
        } else if (err instanceof Error) {
          logger.error(err.message);
        }
        process.exitCode = 1;
        return;
      }

      // Host details (printed first)
      const hostPanelLines = buildHostPanelLines(mgr);

      // One-shot plan; we will render a clack-like panel below
      decisions = await mgr.plan();

      // Persist last plan for later use by `apply`
      try {
        const st = await loadState();
        st.lastPlan = {
          configPath: opts.config,
          host: hostKey(mgr),
          decisions: decisionsToSaved(decisions),
        };
        await saveState(st);
      } catch {
        // ignore errors on saving state
      }

      // Render grouped preview as part of the original gutter
      const planSections = buildPlanSections(mgr, decisions);
      const planLines = [
        buildLegendLine(),
        "",
        ...renderTreeSubsections(planSections),
      ];
      const panel = renderPanelSections([
        { title: "Host Details", lines: hostPanelLines },
        { title: "Plan", lines: planLines },
      ]);
      const summary = buildSummaryLine(computeSummaryFromDecisions(decisions));
      const withSummary = appendSummaryToPanel(panel, summary, "corner");
      logger.log(withSummary);

      // Done
    });
}
