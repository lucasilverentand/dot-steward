import type { Manager } from "@dot-steward/core";
import pc from "picocolors";
import logger from "./logger.ts";
import { type PlanDecision } from "./planFormat.ts";
import { renderPanelSections } from "./ui.ts";
import { buildPlanSections } from "./planSections.ts";
import { renderTreeSubsections } from "./planTree.ts";
import type { SavedDecision } from "../state.ts";

// Render the plan preview exactly like the `plan` command.
export function renderPlanPreview(mgr: Manager, decisions: PlanDecision[]): void {
  const sections = buildPlanSections(mgr, decisions);
  const legend = `${pc.green("+ create")}  ${pc.red("! destroy")}  ${pc.yellow("~ modify")}  ${pc.dim("- no op")}`;
  const planLines = [legend, "", ...renderTreeSubsections(sections)];
  const plus = decisions.filter((d) => d.action === "apply").length;
  const minus = decisions.filter((d) => d.action === "noop").length;
  const tilde = decisions.filter((d) => d.action === "skip").length;
  const bang = 0;
  const sep = ` ${pc.dim("|")} `;
  const summary = `${pc.green("+")} ${plus}${sep}${pc.red("!")} ${bang}${sep}${pc.yellow("~")} ${tilde}${sep}${pc.dim("-")} ${minus}`;
  const panel = renderPanelSections([{ title: "Plan", lines: planLines }]);
  const out = panel.split("\n");
  if (out.length > 0 && out[out.length - 1].trim() === "└") {
    out.pop();
    out.push("│");
    // Use rounded-corner with horizontal for final plan summary
    out.push(`├─  ${summary}`);
  }
  logger.log(out.join("\n"));
}

// Reconstruct PlanDecision[] from saved decisions using the manager graph
export function reconstructSavedDecisions(
  mgr: Manager,
  saved: SavedDecision[],
): PlanDecision[] {
  return saved
    .map((sd) => {
      const it = mgr.deps.nodes.get(sd.item_id);
      if (!it) return null;
      return {
        item: it,
        action: sd.action,
        reason: sd.reason,
        details: sd.summary ? ({ summary: sd.summary } as any) : undefined,
      } as unknown as PlanDecision;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
}
