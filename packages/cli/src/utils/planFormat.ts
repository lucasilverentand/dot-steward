import type { Manager } from "@dot-steward/core";

export type PlanDecision = Awaited<ReturnType<Manager["plan"]>>[number];

export function formatDecisionLine(dec: PlanDecision): string {
  const RESET = "\x1b[0m";
  const GREEN = "\x1b[32m";
  const DIM = "\x1b[2m";
  let sym = "-";
  let color = DIM;
  if (dec.action === "apply") {
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
  const label = dec.item.render();
  // Ensure a clear skip indicator when action is skip
  let content = summary ? summary : label;
  if (dec.action === "skip") {
    const hasPrefix = typeof content === "string" && content.trim().startsWith("[skip]");
    if (!hasPrefix) content = `[skip] ${content}`;
  }
  let reasonNote = "";
  if (dec.action === "skip" && dec.reason) {
    const dup = summary && summary.includes(dec.reason);
    reasonNote = dup ? "" : ` ${DIM}(${dec.reason})${RESET}`;
  }
  return `${color}${sym} ${content}${reasonNote}${RESET}`;
}
