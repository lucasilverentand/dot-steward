import { type ApplyResult, Manager } from "@dot-steward/core";
// hostKey moved into the import above
import type { Command } from "commander";
import { decisionsToSaved, hostKey, loadState, saveState } from "../state.ts";
import { type PlanDecision } from "../utils/planFormat.ts";
import * as readline from "node:readline";
// Removed Listr UI dependency for apply progress; we render manually
import logger from "../utils/logger.ts";
import { reconstructSavedDecisions } from "../utils/preview.ts";
import { renderPanelSections } from "../utils/ui.ts";
import { buildPlanSections } from "../utils/planSections.ts";
import { renderTreeSubsections } from "../utils/planTree.ts";
import { buildAppliesSections } from "../utils/appliesSections.ts";
import resolveConfigToFileUrl from "../utils/config.ts";
import { appendSummaryToPanel, buildLegendLine, buildSummaryLine, computeSummaryFromDecisions, type SummaryCounts } from "../utils/summary.ts";
import { collectAggregateErrors } from "../utils/errors.ts";
import pc from "picocolors";
import { buildHostPanelLines } from "../utils/host.ts";
import { computeRemovedSinceLastApply, formatRemovalsSection, buildRemovalLinesByProfile } from "../utils/removals.ts";
import { buildRemovalTasks, runRemovalTasksWithUI } from "../utils/removalTasks.ts";

type PlannedLabel = { id: string; title: string };

async function askConfirm(message: string): Promise<boolean> {
  // Interactive Yes/No selector with arrow keys, space to toggle, Enter to confirm
  // Fallback to readline prompt when TTY is unavailable.
  const stdin = process.stdin;
  const stdout = process.stdout;
  const isTTY = !!stdin.isTTY && !!stdout.isTTY;

  const render = (yesSelected: boolean): string => {
    const choice = yesSelected ? "├─  ● Yes / ○ No" : "├─  ○ Yes / ● No";
    return ["│", `◆  ${message}`, "│", choice].join("\n");
  };

  if (isTTY) {
    let yes = true; // default selection
    const linesCount = 4; // panel height (message assumed single-line), no closing corner
    const repaint = (initial = false) => {
      const panel = render(yes);
      if (!initial) stdout.write(`\x1b[${linesCount}A\x1b[J`); // move up and clear
      stdout.write(panel + "\n");
    };
    // Initial paint
    repaint(true);

    return await new Promise<boolean>((resolve) => {
      const onData = (data: Buffer | string) => {
        const s = Buffer.isBuffer(data) ? data.toString("utf8") : data;
        // Handle control keys
        if (s === "\r" || s === "\n") {
          cleanup();
          resolve(yes);
          return;
        }
        if (s === "\x03" /* Ctrl-C */ || s === "\x1b" /* Esc */) {
          cleanup();
          resolve(false);
          return;
        }
        // Arrow keys, vim, WASD, space, y/n
        if (s === "\x1b[C" /* right */ || s === "l" || s === "d" || s === "\x1b[B" /* down */) {
          if (yes) {
            yes = false;
            repaint();
          }
          return;
        }
        if (s === "\x1b[D" /* left */ || s === "h" || s === "a" || s === "\x1b[A" /* up */) {
          if (!yes) {
            yes = true;
            repaint();
          }
          return;
        }
        if (s === " " /* space */) {
          yes = !yes;
          repaint();
          return;
        }
        if (s.toLowerCase() === "y") {
          if (!yes) {
            yes = true;
            repaint();
          }
          return;
        }
        if (s.toLowerCase() === "n") {
          if (yes) {
            yes = false;
            repaint();
          }
          return;
        }
      };

      const cleanup = () => {
        stdin.off("data", onData);
        if (stdin.isTTY) stdin.setRawMode(false);
        stdin.pause();
      };

      if (stdin.isTTY) stdin.setRawMode(true);
      stdin.setEncoding("utf8");
      stdin.resume();
      stdin.on("data", onData);
    });
  }

  // Fallback (non-TTY): simple readline yes/no input
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer: string = await new Promise((resolve) =>
      rl.question(`${message} (y/n): `, resolve as (v: string) => void),
    );
    const a = (answer || "").trim().toLowerCase();
    return a === "y" || a === "yes";
  } finally {
    rl.close();
  }
}

// Preview rendering is unified via renderPlanPreview in utils/preview

// moved to ../utils/errors

async function applyWithListr(
  mgr: Manager,
  planned: PlannedLabel[],
  opts: { skipUpdates?: boolean; forceApply?: boolean },
  summaryCounts?: SummaryCounts,
): Promise<void> {
  // Manual, clack-like live renderer (no Listr). We mirror the style used elsewhere.
  type Status = "pending" | "running" | "done" | "skip" | "error";
  type Row = { id: string; title: string; status: Status; note?: string };
  const rows: Row[] = planned.map((p) => ({ id: p.id, title: p.title, status: "pending" }));
  const rowById = new Map<string, Row>(rows.map((r) => [r.id, r]));

  // Track completion and errors per item
  type Waiter = {
    promise: Promise<void>;
    resolve: () => void;
    reject: (err: Error) => void;
  };
  const waiters = new Map<string, Waiter>();
  for (const r of rows) {
    let _resolve: () => void = () => {};
    let _reject: (e: Error) => void = () => {};
    const promise = new Promise<void>((res, rej) => {
      _resolve = res;
      _reject = rej;
    });
    waiters.set(r.id, { promise, resolve: _resolve, reject: _reject });
  }

  const stdin = process.stdin;
  const stdout = process.stdout;
  const isTTY = !!stdin.isTTY && !!stdout.isTTY;
  let printedLines = 0;

  const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let spinnerIdx = 0;
  let spinnerTimer: NodeJS.Timeout | null = null;
  // Optional final summary footer to append after apply completes
  let footerSummary: string | null = null;

  const symbol = (row: Row): string => {
    switch (row.status) {
      case "pending":
        return pc.dim("○");
      case "running":
        return pc.cyan(spinnerFrames[spinnerIdx % spinnerFrames.length]);
      case "done":
        return pc.green("✔");
      case "skip":
        return pc.yellow("↷");
      case "error":
        return pc.red("✖");
    }
  };

  const formatLine = (row: Row): string => {
    const note = row.note ? ` ${pc.dim("(")}${row.note}${pc.dim(")")}` : "";
    return `│  ${symbol(row)} ${row.title}${note}`;
  };

  // Group rows by section: Plugins first, then per profile
  type Section = { title: string; rows: Row[] };
  const sections: Section[] = [];

  // Collect plugin rows
  const pluginRows: Row[] = [];
  for (const r of rows) {
    const it = mgr.deps.nodes.get(r.id) as unknown as { kind?: string } | undefined;
    if (it && it.kind === "plugin") pluginRows.push(r);
  }
  if (pluginRows.length > 0) sections.push({ title: "Plugins", rows: pluginRows });

  // Collect per-profile rows (include only non-empty sections for live view)
  for (const p of mgr.profiles) {
    const matched = mgr.active_profiles.includes(p);
    const profRows: Row[] = [];
    for (const it of p.items) {
      const r = rowById.get(it.id);
      if (r) profRows.push(r);
    }
    if (profRows.length > 0) {
      const matchNote = matched ? pc.green("✓ match") : pc.dim("✗ no match");
      const title = `Profile: ${p.name}  ${matchNote}`;
      sections.push({ title, rows: profRows });
    }
  }

  const draw = () => {
    const header = "◆  Apply";
    const lines: string[] = ["│", header, "│"];
    if (sections.length === 0) {
      // Fallback to flat list
      lines.push(...rows.map(formatLine));
    } else {
      sections.forEach((sec, idx) => {
        lines.push(`├─ ${sec.title}`);
        for (const r of sec.rows) lines.push(formatLine(r));
        if (idx < sections.length - 1) lines.push("│"); // spacer between sections
      });
    }
    if (footerSummary) {
      lines.push("│");
      lines.push(`╰─  ${footerSummary}`);
    } else {
      lines.push("└");
    }
    if (isTTY && printedLines > 0) {
      stdout.write(`\x1b[${printedLines}A\x1b[J`);
    }
    stdout.write(lines.join("\n") + "\n");
    printedLines = lines.length;
  };

  const startSpinner = () => {
    if (!isTTY || spinnerTimer) return;
    spinnerTimer = setInterval(() => {
      spinnerIdx = (spinnerIdx + 1) % spinnerFrames.length;
      if (rows.some((r) => r.status === "running")) draw();
    }, 80);
  };
  const stopSpinner = () => {
    if (spinnerTimer) {
      clearInterval(spinnerTimer);
      spinnerTimer = null;
    }
  };

  // Initial paint
  draw();

  // Wire global listeners to update rows and settle waiters
  const offStart = mgr.events.on("item:apply_start", (ev) => {
    const row = rows.find((r) => r.id === ev.item_id);
    if (row) {
      row.status = "running";
      row.note = "applying";
      startSpinner();
      if (isTTY) draw();
      else logger.log(`${pc.cyan("→")} ${row.title}`);
    }
  });
  const offDone = mgr.events.on("item:apply_done", (ev) => {
    const row = rows.find((r) => r.id === ev.item_id);
    if (row) {
      row.status = "done";
      row.note = undefined;
      const w = waiters.get(ev.item_id);
      w?.resolve();
      if (isTTY) draw();
      else logger.log(`${pc.green("✔")} ${row.title}`);
    }
  });
  const offErr = mgr.events.on("item:apply_error", (ev) => {
    const row = rows.find((r) => r.id === ev.item_id);
    if (row) {
      row.status = "error";
      row.note = ev.error;
      const w = waiters.get(ev.item_id);
      w?.reject(new Error(ev.error));
      if (isTTY) draw();
      else logger.error(`${pc.red("✖")} ${row.title} ${pc.dim("->")} ${ev.error}`);
    }
  });
  const offSkip = mgr.events.on("item:apply_skip", (ev) => {
    const row = rows.find((r) => r.id === ev.item_id);
    if (row) {
      row.status = "skip";
      row.note = ev.reason ?? (ev.blocked_by?.length ? "blocked" : "skipped");
      const w = waiters.get(ev.item_id);
      w?.resolve();
      if (isTTY) draw();
      else logger.log(`${pc.yellow("↷")} ${row.title} ${pc.dim("->")} ${row.note}`);
    }
  });

  let applyErr: unknown = null;
  const applyPromise = mgr
    .apply({ skipUpdates: !!opts.skipUpdates, forceApply: !!opts.forceApply })
    .catch((e) => {
      applyErr = e;
    })
    .finally(() => {
      offStart();
      offDone();
      offErr();
      offSkip();
    });

  // Wait for all items to settle and for apply to finish
  await Promise.allSettled([applyPromise, ...[...waiters.values()].map((w) => w.promise)]);
  stopSpinner();
  // Build final footer summary line to mirror plan preview summary
  try {
    const counts: SummaryCounts = {
      plus: summaryCounts?.plus ?? rows.filter((r) => r.status === "done").length,
      minus: summaryCounts?.minus ?? 0,
      tilde: summaryCounts?.tilde ?? rows.filter((r) => r.status === "skip").length,
      bang: summaryCounts?.bang ?? 0,
    };
    footerSummary = buildSummaryLine(counts);
  } catch {
    footerSummary = null;
  }
  // Final redraw to ensure finished state is printed (with summary)
  if (isTTY) draw();
  if (applyErr) throw applyErr;
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
    .option("-f, --force", "Force re-run apply for already-applied items")
    .action(async (opts: { config: string; skipUpdates?: boolean; force?: boolean }) => {
      const mgr = new Manager();
      const cfgUrl = resolveConfigToFileUrl(opts.config);
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
        // Prompt only; do not reprint Host Details when using a saved plan
        useSavedPlan = await askConfirm("Load plan from plan mode?");
      }

      let result: ApplyResult | null = null;
      // Track whether we showed live progress (so we can avoid duplicate final summary)
      let usedLiveRenderer = false;
      // Track whether we actually performed an apply (user confirmed)
      let actuallyApplied = false;
      // Track if the user confirmed to proceed (applies or removals)
      let userConfirmed = false;
      type Decisions = Awaited<ReturnType<typeof mgr.plan>>;
      let decisions: Decisions | null = null;

      // Styling via picocolors (pc)
      if (useSavedPlan && last) {
        // Reconstruct all saved decisions once; use for preview and apply
        const reconstructed: PlanDecision[] = await reconstructSavedDecisions(
          mgr,
          last.decisions,
        );

        // Consider removals as work too
        let removedSavedCount = 0;
        try {
          const stNow = await loadState();
          const removedSaved = computeRemovedSinceLastApply(
            mgr,
            reconstructed,
            stNow.lastApply,
            opts.config,
          );
          removedSavedCount = removedSaved.length;
        } catch {
          removedSavedCount = 0;
        }
        // If there is nothing to apply and nothing to remove, exit early
        const toApplySaved = reconstructed.filter((d) => d.action === "apply").length;
        if (toApplySaved === 0 && removedSavedCount === 0) {
          logger.log("│");
          logger.log(`╰─  ${pc.dim("Nothing to do. All items are up-to-date.")}`);
          // Persist lastApply even on no-op to capture host/config context
          try {
            const chosenApplied = reconstructed
              .filter((d) => d.action === "apply" || d.action === "noop")
              .map((d) => ({
                item_id: d.item.id,
                action: d.action,
                summary: d.details?.summary,
              }));
            // Build id -> profile name map for current config
            const idToProfile = new Map<string, string>();
            for (const p of mgr.profiles) {
              for (const it of p.items) idToProfile.set(it.id, p.name);
            }
            const applied = chosenApplied.map((d) => {
              const it = mgr.deps.nodes.get(d.item_id);
              const label = it ? it.render() : String(d.item_id);
              const kind = it ? it.kind : "item";
              const profile = idToProfile.get(d.item_id);
              return { id: d.item_id, kind, label, summary: d.summary, profile };
            });
            const state = await loadState();
            state.lastApply = {
              configPath: opts.config,
              host: hostKey(mgr),
              applied,
            };
            await saveState(state);
          } catch {
            // ignore save errors
          }
          return;
        }
        // Use saved plan for display; still run analyze+apply freshly
        // (analyze step removed)
        // Print the old (saved) plan for confirmation, matching `plan` formatting
        {
          // Plan preview sections/tree
          const planSections = buildPlanSections(mgr, reconstructed);
          const planLines = [buildLegendLine(), "", ...renderTreeSubsections(planSections)];
          // Include removals preview
          let sections = [{ title: "Plan", lines: planLines }];
          try {
            const stNow = await loadState();
            const removed = computeRemovedSinceLastApply(
              mgr,
              reconstructed,
              stNow.lastApply,
              opts.config,
            );
            const rem = formatRemovalsSection(removed);
            if (rem) sections = [...sections, rem];
          } catch {
            // ignore
          }
          // When reusing a saved plan, we intentionally skip Host Details;
          // only render the confirmation panel here.
          const panel = renderPanelSections(sections);
          const baseSummary = computeSummaryFromDecisions(reconstructed);
          let summary = buildSummaryLine(baseSummary);
          try {
            const stNow = await loadState();
            const removed = computeRemovedSinceLastApply(
              mgr,
              reconstructed,
              stNow.lastApply,
              opts.config,
            );
            summary = buildSummaryLine({ ...baseSummary, bang: removed.length });
          } catch {
            // ignore
          }
          // In apply mode, show branch to indicate follow-up prompt
          const withSummary = appendSummaryToPanel(panel, summary, "branch");
          logger.log(withSummary);
        }
        // Confirm apply using the saved plan preview above
        {
          let removedCountForPrompt = 0;
          try {
            const stNow = await loadState();
            const removed = computeRemovedSinceLastApply(
              mgr,
              reconstructed,
              stNow.lastApply,
              opts.config,
            );
            removedCountForPrompt = removed.length;
          } catch {
            removedCountForPrompt = 0;
          }
          const toApplySavedCount = reconstructed.filter((d) => d.action === "apply").length;
          const promptMsg =
            toApplySavedCount > 0 && removedCountForPrompt > 0
              ? `Apply changes and remove ${removedCountForPrompt} item(s)?`
              : toApplySavedCount > 0
                ? "Apply this plan?"
                : `Remove ${removedCountForPrompt} item(s)?`;
        const proceed = await askConfirm(promptMsg);
        userConfirmed = proceed;
        if (!proceed) {
            // Add a spacer line with the gutter before the aborted message
            logger.log("│");
            logger.log(`╰─  ${pc.dim("Aborted. No changes applied.")}`);
            // Use reconstructed decisions to build a pseudo-result for summary
            result = {
              plan: reconstructed,
              stats: {
                items: reconstructed.length,
                to_apply: reconstructed.filter((d) => d.action === "apply").length,
                skipped: reconstructed.filter((d) => d.action === "skip").length,
                noop: reconstructed.filter((d) => d.action === "noop").length,
              },
              errors: [],
            };
          } else {
          // Apply using saved planned items with live progress
          const plannedList = reconstructed
            .filter((d) => (opts.force ? d.action !== "skip" : d.action === "apply"))
            .map((d) => ({
              id: d.item.id,
              title: d.details?.summary ?? d.item.render(),
            }));
          try {
            if (plannedList.length > 0) {
              usedLiveRenderer = true;
              const plus = plannedList.length;
              const minus = reconstructed.filter((d) => d.action === "noop").length;
              const tilde = reconstructed.filter((d) => d.action === "skip").length;
              await applyWithListr(
                mgr,
                plannedList,
                { skipUpdates: !!opts.skipUpdates, forceApply: !!opts.force },
                { plus, minus, tilde, bang: 0 },
              );
            } else {
              await mgr.apply({ skipUpdates: !!opts.skipUpdates, forceApply: !!opts.force });
            }
              actuallyApplied = true;
              result = {
                plan: reconstructed,
                stats: {
                  items: reconstructed.length,
                  to_apply: plannedList.length,
                  skipped: reconstructed.filter((d) => d.action === "skip").length,
                  noop: reconstructed.filter((d) => d.action === "noop").length,
                },
                errors: [],
              };
            } catch (err) {
              logger.error("Apply failed.");
              const errors = collectAggregateErrors(err);
              result = {
                plan: reconstructed,
                stats: {
                  items: reconstructed.length,
                  to_apply: plannedList.length,
                  skipped: reconstructed.filter((d) => d.action === "skip").length,
                  noop: reconstructed.filter((d) => d.action === "noop").length,
                },
                errors,
              };
            }
          }
        }
        userConfirmed = proceed;
        if (!proceed) {
          // Add a spacer line with the gutter before the aborted message
          logger.log("│");
          logger.log(`╰─  ${pc.dim("Aborted. No changes applied.")}`);
          // Use reconstructed decisions to build a pseudo-result for summary
          result = {
            plan: reconstructed,
            stats: {
              items: reconstructed.length,
              to_apply: reconstructed.filter((d) => d.action === "apply").length,
              skipped: reconstructed.filter((d) => d.action === "skip").length,
              noop: reconstructed.filter((d) => d.action === "noop").length,
            },
            errors: [],
          };
        } else {
          // Apply using saved planned items with live progress
          const plannedList = reconstructed
            .filter((d) => (opts.force ? d.action !== "skip" : d.action === "apply"))
            .map((d) => ({
              id: d.item.id,
              title: d.details?.summary ?? d.item.render(),
            }));
          try {
            if (plannedList.length > 0) {
              usedLiveRenderer = true;
              const plus = plannedList.length;
              const minus = reconstructed.filter((d) => d.action === "noop").length;
              const tilde = reconstructed.filter((d) => d.action === "skip").length;
              await applyWithListr(
                mgr,
                plannedList,
                { skipUpdates: !!opts.skipUpdates, forceApply: !!opts.force },
                { plus, minus, tilde, bang: 0 },
              );
            } else {
              await mgr.apply({ skipUpdates: !!opts.skipUpdates, forceApply: !!opts.force });
            }
            actuallyApplied = true;
            result = {
              plan: reconstructed,
              stats: {
                items: reconstructed.length,
                to_apply: plannedList.length,
                skipped: reconstructed.filter((d) => d.action === "skip").length,
                noop: reconstructed.filter((d) => d.action === "noop").length,
              },
              errors: [],
            };
          } catch (err) {
            logger.error("Apply failed.");
            const errors = collectAggregateErrors(err);
            result = {
              plan: reconstructed,
              stats: {
                items: reconstructed.length,
                to_apply: plannedList.length,
                skipped: reconstructed.filter((d) => d.action === "skip").length,
                noop: reconstructed.filter((d) => d.action === "noop").length,
              },
              errors,
            };
          }
        }
      } else {
        // New interactive flow: Analyze -> Plan -> prompt -> Apply (optional)
        // (analyze step removed)

        try {
          decisions = await mgr.plan();
        } catch (err) {
          logger.error("Plan failed during validation.");
          // Print per-item validation errors when available
          const isAgg =
            !!err &&
            typeof err === "object" &&
            "errors" in (err as Record<string, unknown>);
          if (isAgg) {
            const subErrors = (err as unknown as AggregateError).errors ?? [];
            for (const se of subErrors) {
              const msg = se instanceof Error ? se.message : String(se);
              const m = msg.match(/^([0-9a-fA-F-]{36}):\s*(.*)$/);
              const id = m?.[1] ?? "";
              const detail = m?.[2] ?? msg;
              const it = id ? mgr.deps.nodes.get(id) : undefined;
              const label = it ? it.render() : id || "item";
              logger.error(`${pc.red("!")} ${label} ${pc.dim("->")} ${detail}`);
            }
          } else if (err instanceof Error) {
            logger.error(err.message);
          }
          process.exitCode = 1;
          return;
        }

        // Consider removals as work too
        let removedCount = 0;
        try {
          const stNow = await loadState();
          const removed = computeRemovedSinceLastApply(
            mgr,
            decisions,
            stNow.lastApply,
            opts.config,
          );
          removedCount = removed.length;
        } catch {
          removedCount = 0;
        }
        // If there is nothing to apply or remove, exit early (unless force)
        const toApplyCount = decisions.filter((d) => d.action === "apply").length;
        if (!opts.force && toApplyCount === 0 && removedCount === 0) {
          logger.log("│");
          logger.log(`╰─  ${pc.dim("Nothing to do. All items are up-to-date.")}`);
          // Persist lastApply even on no-op to capture host/config context
          try {
            const chosenApplied = decisions
              .filter((d) => d.action === "apply" || d.action === "noop")
              .map((d) => ({
                item_id: d.item.id,
                action: d.action,
                summary: d.details?.summary,
              }));
            // Build id -> profile name map for current config
            const idToProfile = new Map<string, string>();
            for (const p of mgr.profiles) {
              for (const it of p.items) idToProfile.set(it.id, p.name);
            }
            const applied = chosenApplied.map((d) => {
              const it = mgr.deps.nodes.get(d.item_id);
              const label = it ? it.render() : String(d.item_id);
              const kind = it ? it.kind : "item";
              const profile = idToProfile.get(d.item_id);
              return { id: d.item_id, kind, label, summary: d.summary, profile };
            });
            const state = await loadState();
            state.lastApply = {
              configPath: opts.config,
              host: hostKey(mgr),
              applied,
            };
            await saveState(state);
          } catch {
            // ignore save errors
          }
          return;
        }

        // Render clack-like panel title with items listed below
        {
          // Host details
          const hostPanelLines = buildHostPanelLines(mgr);
          // Apply preview
          const planSections = buildPlanSections(mgr, decisions);
          // Inject removals inline under matching profile sections
          try {
            const st = await loadState();
            const removed = computeRemovedSinceLastApply(mgr, decisions, st.lastApply, opts.config);
            if (removed.length > 0) {
              const byProf = buildRemovalLinesByProfile(removed);
              for (const section of planSections) {
                if (!section.title.startsWith("Profile:")) continue;
                const nameMatch = section.title.match(/^Profile:\s+([^\s].*?)(\s{2,}|$)/);
                const profName = nameMatch?.[1];
                if (!profName) continue;
                const extra = byProf.get(profName);
                if (extra && extra.length > 0) section.lines.push(...extra);
              }
              const leftovers = byProf.get("(previous)") || [];
              if (leftovers.length > 0) planSections.push({ title: "Profile: (previous)", lines: leftovers });
            }
          } catch {
            // ignore
          }
          const planLines = [buildLegendLine(), "", ...renderTreeSubsections(planSections)];
          const panel = renderPanelSections([
            { title: "Host Details", lines: hostPanelLines },
            { title: "Plan", lines: planLines },
          ]);
          const baseSummary = computeSummaryFromDecisions(decisions);
          let summary = buildSummaryLine(baseSummary);
          try {
            const stNow = await loadState();
            const removed = computeRemovedSinceLastApply(
              mgr,
              decisions,
              stNow.lastApply,
              opts.config,
            );
            summary = buildSummaryLine({ ...baseSummary, bang: removed.length });
          } catch {
            // ignore
          }
          const withSummary = appendSummaryToPanel(panel, summary, "branch");
          logger.log(withSummary);
        }

        // Save last plan for future runs
        try {
          const st2 = await loadState();
          st2.lastPlan = {
            configPath: opts.config,
            host: hostKey(mgr),
            decisions: decisionsToSaved(decisions),
          };
          await saveState(st2);
        } catch {
          // ignore state save errors
        }

        // Confirm apply/removal
        let removedCountForPrompt = 0;
        try {
          const stNow = await loadState();
          const removed = computeRemovedSinceLastApply(
            mgr,
            decisions,
            stNow.lastApply,
            opts.config,
          );
          removedCountForPrompt = removed.length;
        } catch {
          removedCountForPrompt = 0;
        }
        {
          const toApplyCount2 = opts.force
            ? decisions.filter((d) => d.action !== "skip").length
            : decisions.filter((d) => d.action === "apply").length;
          const promptMsg =
            toApplyCount2 > 0 && removedCountForPrompt > 0
              ? (opts.force
                  ? `Re-apply ${toApplyCount2} item(s) and remove ${removedCountForPrompt} item(s)?`
                  : `Apply changes and remove ${removedCountForPrompt} item(s)?`)
              : toApplyCount2 > 0
                ? (opts.force ? `Re-apply ${toApplyCount2} item(s)?` : "Apply this plan?")
                : `Remove ${removedCountForPrompt} item(s)?`;
        const proceed = await askConfirm(promptMsg);
        userConfirmed = proceed;
        if (!proceed) {
            // Add a spacer line with the gutter before the aborted message
            logger.log("│");
            logger.log(`╰─  ${pc.dim("Aborted. No changes applied.")}`);
            // Build a pseudo-result so the summary section below still renders
            result = {
              plan: decisions,
              stats: {
                items: decisions.length,
                to_apply: decisions.filter((d) => d.action === "apply").length,
                skipped: decisions.filter((d) => d.action === "skip").length,
                noop: decisions.filter((d) => d.action === "noop").length,
              },
              errors: [],
            };
          } else {
            // Apply using the plan context already computed with live progress
            const toApply = decisions.filter((d) => (opts.force ? d.action !== "skip" : d.action === "apply"));
            const plannedList = toApply.map((d) => ({
              id: d.item.id,
              title: d.details?.summary ?? d.item.render(),
            }));
            try {
              if (plannedList.length > 0) {
                usedLiveRenderer = true;
                const plus = toApply.length;
                const minus = decisions.filter((d) => d.action === "noop").length;
                const tilde = decisions.filter((d) => d.action === "skip").length;
                // Compute removals compared to last apply (same host/config)
                let bang = 0;
                try {
                  const st2 = await loadState();
                  const removed = computeRemovedSinceLastApply(
                    mgr,
                    decisions,
                    st2.lastApply,
                    opts.config,
                  );
                  bang = removed.length;
                } catch {
                  bang = 0;
                }
                await applyWithListr(
                  mgr,
                  plannedList,
                  { skipUpdates: !!opts.skipUpdates, forceApply: !!opts.force },
                  { plus, minus, tilde, bang },
                );
              } else {
                await mgr.apply({ skipUpdates: !!opts.skipUpdates, forceApply: !!opts.force });
              }
              actuallyApplied = true;
              const planNow = decisions ?? ([] as Decisions);
              result = {
                plan: planNow,
                stats: {
                  items: planNow.length,
                  to_apply: toApply.length,
                  skipped: decisions.filter((d) => d.action === "skip").length,
                  noop: decisions.filter((d) => d.action === "noop").length,
                },
                errors: [],
              };
            } catch (err) {
              logger.error("Apply failed.");
              // Collect apply errors for display in the summary section
              const errors = collectAggregateErrors(err);
              result = {
                plan: decisions,
                stats: {
                  items: decisions.length,
                  to_apply: decisions.filter((d) => d.action === "apply").length,
                  skipped: decisions.filter((d) => d.action === "skip").length,
                  noop: decisions.filter((d) => d.action === "noop").length,
                },
                errors,
              };
            }
          }
        }
      }

      // Styling provided by picocolors

      // No summary panel; live progress plus any errors are sufficient
      if (!result) return; // safety

      // Render an "Applies" panel only if we actually applied
      // and we didn't already show the live per-item renderer.
      // This lists items that were applied (based on the plan), grouped like the plan.
      if (actuallyApplied && !usedLiveRenderer) {
        const decisionsAll = result.plan;
        const appliesSections = buildAppliesSections(mgr, decisionsAll);
        // Only render if there's anything to show
        const hasAny = appliesSections.some((s) => s.lines.length > 0);
        if (hasAny) {
          const appliesLines = renderTreeSubsections(appliesSections);
          const panel = renderPanelSections([
            { title: "Applies", lines: appliesLines },
          ]);
          // Append a summary to the closing corner, consistent with plan preview
          let summary = buildSummaryLine(computeSummaryFromDecisions(decisionsAll));
          try {
            const st2 = await loadState();
            const removed = computeRemovedSinceLastApply(
              mgr,
              decisionsAll,
              st2.lastApply,
              opts.config,
            );
            const base = computeSummaryFromDecisions(decisionsAll);
            summary = buildSummaryLine({ ...base, bang: removed.length });
          } catch {
            // ignore
          }
          const withSummary = appendSummaryToPanel(panel, summary, "corner");
          logger.log(withSummary);
        }
      }

      // After apply (and user confirmation), execute removals as proper tasks with progress UI
      try {
        if (!userConfirmed) {
          // user aborted; do not perform removals
          return;
        }
        const stNow = await loadState();
        const removed = computeRemovedSinceLastApply(
          mgr,
          result.plan,
          stNow.lastApply,
          opts.config,
        );
        if (removed.length > 0) {
          const tasks = buildRemovalTasks(mgr, removed);
          if (tasks.length > 0) {
            await runRemovalTasksWithUI(tasks);
          }
        }
      } catch {
        // ignore rendering errors
      }

      // Errors (if any)
      if (result.errors.length > 0) {
        logger.log("");
        logger.error(pc.red("Errors:"));
        for (const e of result.errors) {
          const it = e.id ? mgr.deps.nodes.get(e.id) : undefined;
          const label = it ? it.render() : e.id || "item";
          logger.error(`${pc.red("!")} ${label} ${pc.dim("->")} ${e.error}`);
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
        ).filter((d) => d.action === "apply" || d.action === "noop");
        // Build id -> profile name map for current config
        const idToProfile = new Map<string, string>();
        for (const p of mgr.profiles) {
          for (const it of p.items) idToProfile.set(it.id, p.name);
        }
        const applied = chosenApplied.map((d) => {
          const it = mgr.deps.nodes.get(d.item_id);
          const label = it ? it.render() : String(d.item_id);
          const kind = it ? it.kind : "item";
          const profile = idToProfile.get(d.item_id);
          return { id: d.item_id, kind, label, summary: d.summary, profile };
        });
        const state = await loadState();
        state.lastApply = {
          configPath: opts.config,
          host: hostKey(mgr),
          applied,
        };
        await saveState(state);
      } catch {
        // ignore save errors
      }
    });
}
