import pc from "picocolors";
import type { PlanDecision } from "./planFormat.ts";

export type SummaryCounts = { plus: number; minus: number; tilde: number; bang?: number };

export function buildLegendLine(): string {
  return `${pc.green("+ create")}  ${pc.red("! destroy")}  ${pc.yellow("~ modify")}  ${pc.dim("- no op")}`;
}

export function computeSummaryFromDecisions(decisions: PlanDecision[]): SummaryCounts {
  const isUpdate = (d: PlanDecision): boolean =>
    typeof d.details?.summary === "string" &&
    /^\s*\[(update|modify)\]/i.test(d.details.summary);
  const plus = decisions.filter((d) => d.action === "apply" && !isUpdate(d)).length;
  const tilde = decisions.filter((d) => d.action === "apply" && isUpdate(d)).length;
  const minus = decisions.filter((d) => d.action === "noop").length;
  return { plus, minus, tilde, bang: 0 };
}

export function buildSummaryLine(counts: SummaryCounts): string {
  const { plus, minus, tilde, bang = 0 } = counts;
  const sep = ` ${pc.dim("|")} `;
  return `${pc.green("+")} ${plus}${sep}${pc.red("!")} ${bang}${sep}${pc.yellow("~")} ${tilde}${sep}${pc.dim("-")} ${minus}`;
}

// Append a summary to the end of a pre-rendered panel.
// variant:
// - 'corner' -> uses "╰─  <summary>" as the final line
// - 'branch' -> uses "├─  <summary>" to indicate a follow-up prompt
export function appendSummaryToPanel(
  panel: string,
  summary: string,
  variant: "corner" | "branch" = "corner",
): string {
  const lines = panel.split("\n");
  if (lines.length > 0 && lines[lines.length - 1].trim() === "└") {
    lines.pop();
    lines.push("│");
    const prefix = variant === "branch" ? "├─" : "╰─";
    lines.push(`${prefix}  ${summary}`);
  }
  return lines.join("\n");
}
