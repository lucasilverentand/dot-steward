import { Manager } from "@dot-steward/core";
import type { Command } from "commander";
import { decisionsToSaved, hostKey, loadState, saveState } from "../state.ts";
import logger from "../utils/logger.ts";
import { renderPanelSections } from "../utils/ui.ts";
import { buildPlanSections } from "../utils/planSections.ts";
import { renderTreeSubsections } from "../utils/planTree.ts";
import resolveConfigToFileUrl from "../utils/config.ts";
import { appendSummaryToPanel, buildLegendLine, buildSummaryLine, computeSummaryFromDecisions } from "../utils/summary.ts";
import { computeRemovedSinceLastApply, buildRemovalLinesByProfile } from "../utils/removals.ts";
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

      // Compute removals based on lastApply vs current plan
      let removedCount = 0;
      try {
        const st = await loadState();
        const removed = computeRemovedSinceLastApply(mgr, decisions, st.lastApply, opts.config);
        removedCount = removed.length;
        // Inline injection: append removal lines to matching profile sections
        if (removed.length > 0) {
          const byProf = buildRemovalLinesByProfile(removed);
          // Update planSections after building
        }
      } catch {
        removedCount = 0;
      }

      // Render grouped preview as part of the original gutter
      const planSections = buildPlanSections(mgr, decisions);
      // Append removal lines inline under matching profile sections
      try {
        const st = await loadState();
        const removed = computeRemovedSinceLastApply(mgr, decisions, st.lastApply, opts.config);
        if (removed.length > 0) {
          const byProf = buildRemovalLinesByProfile(removed);
          for (const section of planSections) {
            // Section titles are: "Plugins" or `Profile: <name>  ...`
            if (!section.title.startsWith("Profile:")) continue;
            const nameMatch = section.title.match(/^Profile:\s+([^\s].*?)(\s{2,}|$)/);
            const profName = nameMatch?.[1];
            if (!profName) continue;
            const extra = byProf.get(profName);
            if (extra && extra.length > 0) section.lines.push(...extra);
          }
          // Leftovers (previous profiles) -> append a dedicated trailing section once
          const leftovers = byProf.get("(previous)") || [];
          if (leftovers.length > 0) {
            planSections.push({ title: "Profile: (previous)", lines: leftovers });
          }
        }
      } catch {
        // ignore
      }
      const planLines = [
        buildLegendLine(),
        "",
        ...renderTreeSubsections(planSections),
      ];
      const sections = [
        { title: "Host Details", lines: hostPanelLines },
        { title: "Plan", lines: planLines },
      ];
      const panel = renderPanelSections(sections);
      const baseSummary = computeSummaryFromDecisions(decisions);
      const summary = buildSummaryLine({ ...baseSummary, bang: removedCount });
      const withSummary = appendSummaryToPanel(panel, summary, "corner");
      logger.log(withSummary);

      // Done
    });
}
