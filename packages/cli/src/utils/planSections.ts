import type { Manager } from "@dot-steward/core";
import pc from "picocolors";
import { formatDecisionLine, type PlanDecision } from "./planFormat.ts";

export type PanelSection = { title: string; lines: string[] };

/**
 * Build panel sections for a plan preview:
 * - Plugins first
 * - Then one section per profile, showing match status
 * The legend is inserted at the top of the very first section.
 */
export function buildPlanSections(
  mgr: Manager,
  decisions: PlanDecision[],
): PanelSection[] {
  const sections: PanelSection[] = [];

  // Split decisions: plugins vs items
  const pluginDecisions = decisions.filter((d) => (d.item as any).kind === "plugin");
  const itemDecisions = decisions.filter((d) => (d.item as any).kind !== "plugin");

  // Helper: map item.id -> profile name (active profiles only)
  const idToProfile = new Map<string, string>();
  for (const p of mgr.active_profiles) {
    for (const it of p.items) idToProfile.set(it.id, p.name);
  }

  // Plugins section (first)
  if (pluginDecisions.length > 0) {
    const lines = pluginDecisions.map((d) => formatDecisionLine(d));
    sections.push({ title: "Plugins", lines });
  }

  // Profiles: include all profiles; group lines by profile
  for (const p of mgr.profiles) {
    const matched = mgr.active_profiles.includes(p);
    const profLines = itemDecisions
      .filter((d) => idToProfile.get(d.item.id) === p.name)
      .map((d) => formatDecisionLine(d));
    const matchNote = matched ? pc.green("✓ match") : pc.dim("✗ no match");
    const title = `Profile: ${p.name}  ${matchNote}`;
    sections.push({ title, lines: profLines });
  }

  return sections;
}
