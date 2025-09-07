import type { ItemPlan, Manager } from "@dot-steward/core";
import type { SavedDecision } from "../state.ts";
import logger from "./logger.ts";
import type { PlanDecision } from "./planFormat.ts";
import { buildPlanSections } from "./planSections.ts";
import { renderTreeSubsections } from "./planTree.ts";
import {
  appendSummaryToPanel,
  buildLegendLine,
  buildSummaryLine,
  computeSummaryFromDecisions,
} from "./summary.ts";
import { renderPanelSections } from "./ui.ts";

// Render the plan preview exactly like the `plan` command.
export function renderPlanPreview(
  mgr: Manager,
  decisions: PlanDecision[],
): void {
  const sections = buildPlanSections(mgr, decisions);
  const planLines = [buildLegendLine(), "", ...renderTreeSubsections(sections)];
  const summary = buildSummaryLine(computeSummaryFromDecisions(decisions));
  const panel = renderPanelSections([{ title: "Plan", lines: planLines }]);
  const withSummary = appendSummaryToPanel(panel, summary, "corner");
  logger.log(withSummary);
}

// Reconstruct PlanDecision[] from saved decisions using the manager graph
export async function reconstructSavedDecisions(
  mgr: Manager,
  saved: SavedDecision[],
): Promise<PlanDecision[]> {
  // Build a fresh plan to map saved entries to current items.
  // Item UUIDs are not stable across runs unless explicitly set,
  // so we primarily match on the plan summary, falling back to id when possible.
  let current: PlanDecision[] = [] as unknown as PlanDecision[];
  try {
    current = await mgr.plan();
  } catch {
    current = [] as unknown as PlanDecision[];
  }
  const byId = new Map<string, PlanDecision>();
  const bySummary = new Map<string, PlanDecision[]>();
  for (const d of current) {
    byId.set(d.item.id, d);
    const s = d.details?.summary;
    if (s) {
      const arr = bySummary.get(s) ?? [];
      arr.push(d);
      bySummary.set(s, arr);
    }
  }
  const used = new Set<string>();
  const out: PlanDecision[] = [] as unknown as PlanDecision[];
  for (const sd of saved) {
    // Prefer exact id match when stable ids are used
    let match: PlanDecision | undefined = byId.get(sd.item_id);
    if (!match && sd.summary) {
      const arr = bySummary.get(sd.summary);
      if (arr && arr.length > 0) {
        // choose the first unused item with this summary
        match = arr.find((d) => !used.has(d.item.id)) ?? arr[0];
      }
    }
    if (!match) continue; // unable to map this saved decision to current graph
    used.add(match.item.id);
    // Reconstruct a decision object that mirrors the saved action/reason,
    // but uses the current item reference so grouping and rendering work.
    out.push({
      item: match.item,
      action: sd.action,
      reason: sd.reason,
      details: sd.summary
        ? ({ summary: sd.summary } as ItemPlan)
        : match.details,
    } as unknown as PlanDecision);
  }
  if (out.length === 0 && saved.length > 0) {
    logger.debug?.(
      "Saved plan could not be mapped to current items (ids likely changed)",
    );
  }
  return out;
}
