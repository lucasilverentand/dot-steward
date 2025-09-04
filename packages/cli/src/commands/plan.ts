import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { Manager } from "@dot-steward/core";
import { renderListBox } from "../utils/table.ts";
import type { Command } from "commander";

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
        console.error(
          `Failed to load config from ${opts.config}. Try --config examples/config.ts`,
        );
        if (err instanceof Error) console.error(err.message);
        process.exitCode = 1;
        return;
      }

      // Analyze to establish current state before planning
      try {
        await mgr.analyze();
      } catch (err) {
        console.error("Analyze failed while probing plugins.");
        if (err instanceof Error) console.error(err.message);
        process.exitCode = 1;
        return;
      }

      // Compute plan decisions
      let decisions: Awaited<ReturnType<typeof mgr.plan>>;
      try {
        decisions = await mgr.plan();
      } catch (err) {
        console.error("Plan failed during validation.");
        // Show actionable, per-item validation errors when available
        const isAgg =
          !!err && typeof err === "object" && "errors" in (err as any);
        if (isAgg) {
          const RESET = "\x1b[0m";
          const RED = "\x1b[31m";
          const DIM = "\x1b[2m";
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
            console.error(`${RED}! ${label}${RESET} ${DIM}->${RESET} ${detail}`);
          }
        } else if (err instanceof Error) {
          console.error(err.message);
        }
        process.exitCode = 1;
        return;
      }

      // Legend with colors (Terraform-like)
      const RESET = "\x1b[0m";
      const GREEN = "\x1b[32m"; // create
      const RED = "\x1b[31m"; // destroy
      const YELLOW = "\x1b[33m"; // modify
      const DIM = "\x1b[2m"; // dim text / no op
      const legendLine = `${GREEN}+ create${RESET}  ${RED}! destroy${RESET}  ${YELLOW}~ modify${RESET}  ${DIM}- no op${RESET}`;
      console.log(
        renderListBox([legendLine], {
          title: `${DIM}legend${RESET}`,
          bullet: "",
          padding: 1,
        }),
      );
      // Blank line below legend for spacing
      console.log("");

      const decisionById = new Map(
        decisions.map((d) => [d.item.id, d] as const),
      );

      // Render a concise Plugins section before profiles
      if (mgr.plugins.length > 0) {
        console.log("Plugins:");
        for (const plg of mgr.plugins) {
          const dec = decisionById.get(plg.id);
          const label = plg.render();
          // Default to no-op if no explicit decision found
          const action = dec?.action ?? "noop";
          let sym = "-";
          let color = DIM;
          if (action === "apply") {
            sym = "+";
            color = GREEN;
          } else if (action === "skip") {
            sym = "-";
            color = DIM;
          }
          // Usage: how many items depend on this plugin in the active graph
          const usedBy = mgr.deps.outgoing.get(plg.id)?.size ?? 0;
          const usageNote = ` ${DIM}(used by ${usedBy})${RESET}`;
          // Append reason for skips when available
          let reasonNote = "";
          if (dec?.action === "skip" && dec.reason) {
            const summary = dec.details?.summary;
            const dup = summary?.includes(dec.reason);
            reasonNote = dup ? "" : ` ${DIM}(${dec.reason})${RESET}`;
          }
          console.log(`${color}${sym} ${label}${usageNote}${reasonNote}${RESET}`);
        }
        // Spacer between plugins and profiles
        console.log("");
      }

      // Render all profiles in order
      for (const p of mgr.profiles) {
        const matched = mgr.host.evaluateMatch(p.matches);
        // Styled header: dim "profile:" and bold profile name
        const BOLD = "\x1b[1m";
        const title = `${DIM}profile:${RESET}${BOLD}${p.name}${RESET}`;
        if (!matched) {
          console.log(`${title} — ${DIM}no match${RESET}`);
          console.log("");
          continue;
        }
        console.log(title);
        // Items for this profile (even if some are incompatible at item level)
        for (const it of p.items) {
          const dec = decisionById.get(it.id);
          const label = it.render();
          if (!dec) {
            // Not part of active graph (should be rare); show as no-op
            console.log(`${DIM}- ${label} (not considered)${RESET}`);
            continue;
          }
          let sym = "-";
          let color = DIM;
          // Map actions to Terraform-like symbols
          if (dec.action === "apply") {
            // Default to create (we don't differentiate modify yet)
            sym = "+";
            color = GREEN;
          } else if (dec.action === "noop") {
            sym = "-";
            color = DIM;
          } else if (dec.action === "skip") {
            sym = "-";
            color = DIM;
          }
          const summary = dec.details?.summary;
          // Append reasons (like validation errors) even when a summary exists,
          // but avoid duplicating when already present in the summary.
          let reasonNote = "";
          if (dec.action === "skip" && dec.reason) {
            const dup = summary && summary.includes(dec.reason);
            reasonNote = dup ? "" : ` ${DIM}(${dec.reason})${RESET}`;
          }
          const content = summary ? summary : label;
          const line = `${color}${sym} ${content}${reasonNote}${RESET}`;
          console.log(line);
        }
        // Blank line after items for this profile
        console.log("");
      }

      // Done
    });
}
