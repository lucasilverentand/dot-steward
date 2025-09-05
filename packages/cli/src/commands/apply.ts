import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { type ApplyResult, Manager } from "@dot-steward/core";
// hostKey moved into the import above
import type { Command } from "commander";
import { decisionsToSaved, hostKey, loadState, saveState } from "../state.ts";
import { type PlanDecision, formatDecisionLine } from "../utils/planFormat.ts";
import { renderListBox } from "../utils/table.ts";

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
    .option("--skip-updates", "Skip upgrade checks for already-installed items")
    .action(async (opts: { config: string; skipUpdates?: boolean }) => {
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
        const rli = rl.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        const ans = (await rli.question("Use last saved plan? [y/N] "))
          .trim()
          .toLowerCase();
        rli.close();
        useSavedPlan = ans === "y" || ans === "yes";
      }

      let result: ApplyResult | null = null;
      type Decisions = Awaited<ReturnType<typeof mgr.plan>>;
      let decisions: Decisions | null = null;

      // --- Streaming progress renderer
      type ProgressStatus =
        | "pending"
        | "applying"
        | "done"
        | "skipped"
        | "waiting"
        | "error";
      type ProgressItem = {
        id: string;
        title: string;
        status: ProgressStatus;
        reason?: string;
      };
      const isTTY = !!(process.stdout as unknown as { isTTY?: boolean }).isTTY;
      const GREEN = "\x1b[32m";
      const YELLOW = "\x1b[33m";
      const RED = "\x1b[31m";
      const DIM = "\x1b[2m";
      const RESET = "\x1b[0m";

      function renderProgress(
        items: ProgressItem[],
        title: string,
        idToProfile?: Map<string, string>,
      ): string {
        const order = items.slice();
        const lineFor = (pi: ProgressItem): string => {
          switch (pi.status) {
            case "pending":
              return `${DIM}• ${pi.title} ${DIM}(pending)${RESET}`;
            case "applying":
              return `${YELLOW}… ${pi.title} ${DIM}(applying)${RESET}`;
            case "done":
              return `${GREEN}✓ ${pi.title}${RESET}`;
            case "skipped":
              return `${DIM}→ ${pi.title}${pi.reason ? ` (${pi.reason})` : ""}${RESET}`;
            case "waiting":
              return `${DIM}⏸ ${pi.title}${pi.reason ? ` (${pi.reason})` : ""}${RESET}`;
            case "error":
              return `${RED}✗ ${pi.title}${pi.reason ? ` ${DIM}->${RESET} ${pi.reason}` : ""}${RESET}`;
          }
        };
        // Group by profile (and a separate Plugins section for non-profile items)
        let lines: string[] = [];
        if (idToProfile && idToProfile.size > 0) {
          const plugins: ProgressItem[] = [];
          const byProfile = new Map<string, ProgressItem[]>();
          for (const it of order) {
            const prof = idToProfile.get(it.id);
            if (prof) {
              const arr = byProfile.get(prof) ?? [];
              arr.push(it);
              byProfile.set(prof, arr);
            } else {
              plugins.push(it);
            }
          }
          // Plugins first if any
          if (plugins.length > 0) {
            lines.push("Plugins:");
            for (const pi of plugins) lines.push(lineFor(pi));
            lines.push("");
          }
          // Profiles in declaration order from idToProfile's insertion order is per-id; better to follow mgr.profiles
          for (const p of mgr.profiles) {
            const itemsInProfile = byProfile.get(p.name);
            if (!itemsInProfile || itemsInProfile.length === 0) continue;
            // Spacing around each profile group
            lines.push("");
            const BOLD = "\x1b[1m";
            lines.push(`${DIM}profile:${RESET}${BOLD}${p.name}${RESET}`);
            for (const pi of itemsInProfile) lines.push(lineFor(pi));
            lines.push("");
          }
          // Remove trailing excessive blanks (keep leading blank for spacing after title)
          while (lines.length > 0 && lines[lines.length - 1] === "")
            lines.pop();
        } else {
          lines = order.map(lineFor);
        }
        // Build a full-width hyphen separator with the given title centered
        const cols = (() => {
          const c = (process.stdout as unknown as { columns?: number }).columns;
          if (typeof c === "number" && c > 0) return Math.min(200, Math.max(10, c));
          return 80;
        })();
        const label = ` ${title} `;
        const pad = Math.max(0, cols - label.length);
        const left = Math.floor(pad / 2);
        const right = pad - left;
        const t = `${"-".repeat(left)}${label}${"-".repeat(right)}`;
        return renderListBox(lines.length ? lines : ["nothing to do"], {
          title: t,
          titleAlign: "left",
          border: "none",
          dimItems: false,
          bullet: "",
        });
      }

      function makeProgressUI(planned: Array<{ id: string; title: string }>) {
        const items: ProgressItem[] = planned.map((p) => ({
          id: p.id,
          title: p.title,
          status: "pending",
        }));
        const byId = new Map(items.map((i) => [i.id, i] as const));
        // Build id -> profile-name map for grouping
        const plannedIds = new Set(planned.map((p) => p.id));
        const idToProfile = new Map<string, string>();
        for (const p of mgr.profiles) {
          const matched = mgr.host.evaluateMatch(p.matches);
          if (!matched) continue;
          for (const it of p.items) {
            if (plannedIds.has(it.id)) idToProfile.set(it.id, p.name);
          }
        }
        let lastLines = 0;
        let started = false;
        const printFrame = () => {
          const frame = renderProgress(items, "Apply", idToProfile);
          const lines = frame.split("\n");
          if (isTTY) {
            if (started && lastLines > 0) {
              // Move up and clear previous frame
              process.stdout.write(`\x1b[${lastLines}A`);
              process.stdout.write("\x1b[0J");
            }
            process.stdout.write(`${frame}\n`);
            lastLines = lines.length + 1; // include trailing newline
            started = true;
          } else {
            // Non-TTY: just print the changed summary line
            const applied = items.filter((i) => i.status === "done").length;
            const failed = items.filter((i) => i.status === "error").length;
            console.log(
              `Applying: ${applied} done${failed ? `, ${failed} failed` : ""}`,
            );
          }
        };
        const update = (
          id: string,
          status: ProgressStatus,
          reason?: string,
        ) => {
          const it = byId.get(id);
          if (!it) return; // ignore items not in planned set
          it.status = status;
          it.reason = reason;
          printFrame();
        };
        const unsub: Array<() => void> = [];
        unsub.push(
          mgr.events.on("item:apply_start", (p) =>
            update(p.item_id, "applying"),
          ),
        );
        unsub.push(
          mgr.events.on("item:apply_done", (p) => update(p.item_id, "done")),
        );
        unsub.push(
          mgr.events.on("item:apply_error", (p) =>
            update(p.item_id, "error", p.error),
          ),
        );
        unsub.push(
          mgr.events.on("item:apply_skip", (p) => {
            const reason =
              p.reason ?? (p.blocked_by?.length ? "blocked" : undefined);
            const st: ProgressStatus = p.blocked_by?.length
              ? "waiting"
              : "skipped";
            update(p.item_id, st, reason);
          }),
        );
        // initial frame
        printFrame();
        return {
          stop() {
            for (const off of unsub) off();
            if (isTTY && started && lastLines > 0) {
              // Leave the final frame on screen and add a spacer line
              process.stdout.write("\n");
              lastLines = 0;
            }
          },
        };
      }
      if (useSavedPlan && last) {
        // Use saved plan for display; still run analyze+apply freshly
        // (analyze step removed)
        // Print the old (saved) plan for confirmation, grouped by profile
        {
          const BOLD = "\x1b[1m";
          const toApplySaved = last.decisions.filter(
            (d) => d.action === "apply",
          );
          const skippedSaved = last.decisions.filter(
            (d) => d.action === "skip",
          );
          const noopSaved = last.decisions.filter((d) => d.action === "noop");
          console.log(
            `Planned: to apply ${toApplySaved.length}, skipped ${skippedSaved.length}, no-op ${noopSaved.length}`,
          );
          // Reconstruct lightweight decisions with item refs for formatting
          const toApplyReconstructed = toApplySaved
            .map((sd) => {
              const it = mgr.deps.nodes.get(sd.item_id);
              if (!it) return null;
              const rec = {
                item: it,
                action: sd.action,
                reason: sd.reason,
                details: sd.summary
                  ? ({
                      summary: sd.summary,
                    } as unknown as PlanDecision["details"])
                  : undefined,
              } as unknown as PlanDecision; // minimal shape used by formatDecisionLine
              return rec;
            })
            .filter((x): x is NonNullable<typeof x> => !!x);
          const decisionById = new Map(
            toApplyReconstructed.map((d) => [d.item.id, d] as const),
          );
          // Plugins section (only those that are going to apply)
          const pluginsToApply = mgr.plugins
            .map((plg) => decisionById.get(plg.id))
            .filter(
              (d): d is NonNullable<typeof d> => !!d && d.action === "apply",
            );
          const hasPluginsSection = pluginsToApply.length > 0;
          if (hasPluginsSection) {
            console.log("Plugins:");
            for (const d of pluginsToApply) console.log(formatDecisionLine(d));
            console.log("");
          }
          // Profiles: show matched profiles with items that will be applied
          let printedAnyProfile = false;
          for (const p of mgr.profiles) {
            const matched = mgr.host.evaluateMatch(p.matches);
            if (!matched) continue;
            const items = p.items
              .map((it) => decisionById.get(it.id))
              .filter(
                (d): d is NonNullable<typeof d> => !!d && d.action === "apply",
              );
            if (items.length === 0) continue;
            if (!printedAnyProfile && !hasPluginsSection) console.log("");
            printedAnyProfile = true;
            const title = `${DIM}profile:${RESET}${BOLD}${p.name}${RESET}`;
            console.log(title);
            for (const d of items) console.log(formatDecisionLine(d));
            console.log("");
          }
        }
        // Build planned list from last.decisions for streaming
        const plannedList = last.decisions
          .filter((d) => d.action === "apply")
          .map((d) => {
            const it = mgr.deps.nodes.get(d.item_id);
            const label = it ? it.render() : (d.summary ?? d.item_id);
            return { id: d.item_id, title: label };
          });
        let ui: { stop(): void } | null = null;
        try {
          if (plannedList.length > 0) ui = makeProgressUI(plannedList);
          await mgr.apply({ skipUpdates: !!opts.skipUpdates });
        } catch (err) {
          // Collect errors similar to applyAll
          const errors: Array<{ id: string; error: string }> = [];
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
          // Build a pseudo-result for printing
          decisions = await mgr.plan().catch(() => [] as Decisions);
          result = {
            plan: decisions ?? [],
            stats: {
              items: last.decisions.length,
              to_apply: last.decisions.filter((d) => d.action === "apply")
                .length,
              skipped: last.decisions.filter((d) => d.action === "skip").length,
              noop: last.decisions.filter((d) => d.action === "noop").length,
            },
            errors,
          };
        } finally {
          ui?.stop();
        }
        if (!result) {
          // Success path: synthesize result using saved decisions; compute current plan for mapping labels
          decisions = await mgr.plan().catch(() => [] as Decisions);
          result = {
            plan: decisions ?? [],
            stats: {
              items: last.decisions.length,
              to_apply: last.decisions.filter((d) => d.action === "apply")
                .length,
              skipped: last.decisions.filter((d) => d.action === "skip").length,
              noop: last.decisions.filter((d) => d.action === "noop").length,
            },
            errors: [],
          };
        }
      } else {
        // New interactive flow: Analyze -> Plan -> prompt -> Apply (optional)
        // (analyze step removed)

        try {
          decisions = await mgr.plan();
        } catch (err) {
          console.error("Plan failed during validation.");
          // Print per-item validation errors when available
          const isAgg =
            !!err &&
            typeof err === "object" &&
            "errors" in (err as Record<string, unknown>);
          if (isAgg) {
            const RESET = "\x1b[0m";
            const RED = "\x1b[31m";
            const DIM = "\x1b[2m";
            const subErrors = (err as unknown as AggregateError).errors ?? [];
            for (const se of subErrors) {
              const msg = se instanceof Error ? se.message : String(se);
              const m = msg.match(/^([0-9a-fA-F-]{36}):\s*(.*)$/);
              const id = m?.[1] ?? "";
              const detail = m?.[2] ?? msg;
              const it = id ? mgr.deps.nodes.get(id) : undefined;
              const label = it ? it.render() : id || "item";
              console.error(
                `${RED}! ${label}${RESET} ${DIM}->${RESET} ${detail}`,
              );
            }
          } else if (err instanceof Error) {
            console.error(err.message);
          }
          process.exitCode = 1;
          return;
        }

        // Show a concise preview similar to `plan`, grouped by profile
        const RESET = "\x1b[0m";
        const GREEN = "\x1b[32m";
        const DIM = "\x1b[2m";
        const BOLD = "\x1b[1m";
        const toApply = decisions.filter((d) => d.action === "apply");
        const skipped = decisions.filter((d) => d.action === "skip");
        const noop = decisions.filter((d) => d.action === "noop");
        console.log(
          `Planned: to apply ${toApply.length}, skipped ${skipped.length}, no-op ${noop.length}`,
        );

        // Group preview: first plugins to apply, then items grouped by profiles
        const decisionById = new Map(
          decisions.map((d) => [d.item.id, d] as const),
        );

        // Plugins section (only those that are going to apply)
        const pluginsToApply = mgr.plugins
          .map((plg) => decisionById.get(plg.id))
          .filter(
            (d): d is NonNullable<typeof d> => !!d && d.action === "apply",
          );
        const hasPluginsSection = pluginsToApply.length > 0;
        if (hasPluginsSection) {
          console.log("Plugins:");
          for (const d of pluginsToApply) console.log(formatDecisionLine(d));
          console.log("");
        }

        // Profiles: show matched profiles with items that will be applied
        let printedAnyProfile = false;
        for (const p of mgr.profiles) {
          const matched = mgr.host.evaluateMatch(p.matches);
          if (!matched) continue;
          const items = p.items
            .map((it) => decisionById.get(it.id))
            .filter(
              (d): d is NonNullable<typeof d> => !!d && d.action === "apply",
            );
          if (items.length === 0) continue;
          if (!printedAnyProfile && !hasPluginsSection) console.log("");
          printedAnyProfile = true;
          const title = `${DIM}profile:${RESET}${BOLD}${p.name}${RESET}`;
          console.log(title);
          for (const d of items) console.log(formatDecisionLine(d));
          console.log("");
        }

        // Save last plan for future runs
        try {
          const st2 = await loadState();
          st2.lastPlan = {
            configPath: opts.config,
            host: hostKey(mgr),
            at: new Date().toISOString(),
            decisions: decisionsToSaved(decisions),
          };
          await saveState(st2);
        } catch {
          // ignore state save errors
        }

        // Confirm apply
        const rl = await import("node:readline/promises");
        const rli = rl.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        const ans = (await rli.question("Apply this plan? [y/N] "))
          .trim()
          .toLowerCase();
        rli.close();
        const proceed = ans === "y" || ans === "yes";
        if (!proceed) {
          console.log(`${DIM}Aborted. No changes applied.${RESET}`);
          // Build a pseudo-result so the summary section below still renders
          result = {
            plan: decisions,
            stats: {
              items: decisions.length,
              to_apply: toApply.length,
              skipped: skipped.length,
              noop: noop.length,
            },
            errors: [],
          };
        } else {
          // Apply using the plan context already computed with live progress
          const plannedList = toApply.map((d) => ({
            id: d.item.id,
            title: d.details?.summary ?? d.item.render(),
          }));
          let ui: { stop(): void } | null = null;
          try {
            if (plannedList.length > 0) ui = makeProgressUI(plannedList);
            await mgr.apply({ skipUpdates: !!opts.skipUpdates });
            const planNow = decisions ?? ([] as Decisions);
            result = {
              plan: planNow,
              stats: {
                items: planNow.length,
                to_apply: toApply.length,
                skipped: skipped.length,
                noop: noop.length,
              },
              errors: [],
            };
          } catch (err) {
            console.error("Apply failed.");
            // Collect apply errors for display in the summary section
            const errors: Array<{ id: string; error: string }> = [];
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
            result = {
              plan: decisions,
              stats: {
                items: decisions.length,
                to_apply: toApply.length,
                skipped: skipped.length,
                noop: noop.length,
              },
              errors,
            };
          } finally {
            ui?.stop();
          }
        }
      }

      // Colors defined above: GREEN, YELLOW, RED, DIM, RESET

      // Show summary
      if (!result) return; // safety
      const s = result.stats;
      console.log(
        `Summary: to apply ${s.to_apply}, skipped ${s.skipped}, no-op ${s.noop}`,
      );
      console.log("");

      // The live progress already showed applied items; no need to re-list here.

      // Errors (if any)
      if (result.errors.length > 0) {
        console.log("");
        console.error(`${RED}Errors:${RESET}`);
        for (const e of result.errors) {
          const it = e.id ? mgr.deps.nodes.get(e.id) : undefined;
          const label = it ? it.render() : e.id || "item";
          console.error(`${RED}! ${label}${RESET} ${DIM}->${RESET} ${e.error}`);
        }
        process.exitCode = 1;
      }

      // Persist lastApply details for future cleanup decisions
      try {
        const chosenApplied = (
          useSavedPlan && last
            ? last.decisions
            : result.plan.map((d) => ({
                item_id: d.item.id,
                action: d.action,
                summary: d.details?.summary,
              }))
        ).filter((d) => d.action === "apply");
        const applied = chosenApplied.map((d) => {
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
