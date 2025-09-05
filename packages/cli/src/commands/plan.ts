import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { Manager } from "@dot-steward/core";
import type { Command } from "commander";
import { decisionsToSaved, hostKey, loadState, saveState } from "../state.ts";
import logger from "../utils/logger.ts";
import pc from "picocolors";
import { renderPanelSections } from "../utils/ui.ts";
import { buildPlanSections } from "../utils/planSections.ts";
import { renderTreeSubsections } from "../utils/planTree.ts";
// Removed table renderer for host details; we'll print a simple vertical list

function resolveConfigToFileUrl(p: string): string {
  const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  return pathToFileURL(abs).href;
}

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
        // Show actionable, per-item validation errors when available
        const isAgg =
          !!err &&
          typeof err === "object" &&
          "errors" in (err as Record<string, unknown>);
        if (isAgg) {
          const subErrors = (err as unknown as AggregateError).errors ?? [];
          for (const se of subErrors) {
            const msg = se instanceof Error ? se.message : String(se);
            // Messages are formatted as "<uuid>: <detail>" by Manager
            const m = msg.match(/^([0-9a-fA-F-]{36}):\s*(.*)$/);
            const id = m?.[1] ?? "";
            const detail = m?.[2] ?? msg;
            let label = id ? id.slice(0, 8) : "item";
            if (id) {
              const it = mgr.deps.nodes.get(id);
              if (it) label = it.render();
            }
            logger.error(`${pc.red("!")} ${label} ${pc.dim("->")} ${detail}`);
          }
        } else if (err instanceof Error) {
          logger.error(err.message);
        }
        process.exitCode = 1;
        return;
      }

      // Host details (printed first)
      // Compose compact "env" and "user" lines
      const envFlags = [
        mgr.host.env.ci ? "ci" : "not ci",
        mgr.host.env.devcontainer ? "devcontainer" : "not devcontainer",
      ].join(", ");
      const userName = String(mgr.host.user.name ?? "-");
      const uidStr = String(mgr.host.user.uid ?? "-");
      const gidStr = String(mgr.host.user.gid ?? "-");
      const homeStr = String(mgr.host.user.home ?? "-");
      const userLine = `${userName} (gid: ${gidStr}, uid: ${uidStr}, home: ${homeStr})`;

      const hostLines: Array<[string, string]> = [
        ["Hostname", String(mgr.host.hostname ?? "-")],
        ["OS", String(mgr.host.os ?? "-")],
        ["Arch", String(mgr.host.arch ?? "-")],
        ["Shell", String(mgr.host.env.variables.SHELL ?? "-")],
        ["Env", envFlags],
        ["User", userLine],
      ];
      // Render host details in the same clack-like panel format
      const labelWidth = Math.max(
        0,
        ...hostLines.map(([k]) => String(k).length),
      );
      const hostPanelLines = hostLines.map(([k, v]) => {
        const label = String(k).padStart(labelWidth, " ");
        return `${pc.dim(label)}  ${v}`;
      });

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
      const legend = `${pc.green("+ create")}  ${pc.red("! destroy")}  ${pc.yellow("~ modify")}  ${pc.dim("- no op")}`;
      const planLines = [
        legend,
        "",
        ...renderTreeSubsections(planSections),
      ];
      const panel = renderPanelSections([
        { title: "Host Details", lines: hostPanelLines },
        { title: "Plan", lines: planLines },
      ]);
      // Build summary counts and append to the corner line
      const plus = decisions.filter((d) => d.action === "apply").length;
      const minus = decisions.filter((d) => d.action === "noop").length;
      const tilde = decisions.filter((d) => d.action === "skip").length;
      const bang = 0; // destroy not tracked in current engine
      const sep = ` ${pc.dim("|")} `;
      const summary = `${pc.green("+")} ${plus}${sep}${pc.red("!")} ${bang}${sep}${pc.yellow("~")} ${tilde}${sep}${pc.dim("-")} ${minus}`;
      const linesOut = panel.split("\n");
      // Replace the closing corner with a summary line
      if (linesOut.length > 0 && linesOut[linesOut.length - 1].trim() === "└") {
        linesOut.pop();
        linesOut.push("│");
        // Use rounded-corner with horizontal for final plan summary
        linesOut.push(`├─  ${summary}`);
      }
      logger.log(linesOut.join("\n"));

      // Done
    });
}
