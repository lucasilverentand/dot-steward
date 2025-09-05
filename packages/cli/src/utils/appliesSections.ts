import type { Manager } from "@dot-steward/core";
import pc from "picocolors";
import type { PlanDecision } from "./planFormat.ts";
import type { PanelSection } from "./planSections.ts";

export function formatAppliedLine(dec: PlanDecision): string {
  const GREEN = "\x1b[32m";
  const RESET = "\x1b[0m";
  const label = dec.details?.summary ?? dec.item.render();
  return `${GREEN}✔ ${label}${RESET}`;
}

/**
 * Build sections for the applied items list, mirroring the plan grouping:
 * - "Plugins" section first (for plugin items)
 * - One section per profile (with match status note)
 * Only includes decisions with action === "apply".
 */
export function buildAppliesSections(
  mgr: Manager,
  decisions: PlanDecision[],
): PanelSection[] {
  const sections: PanelSection[] = [];

  const applied = decisions.filter((d) => d.action === "apply");
  if (applied.length === 0) return sections;

  const pluginApplied = applied.filter((d) => (d.item as any).kind === "plugin");
  const itemApplied = applied.filter((d) => (d.item as any).kind !== "plugin");

  // Map item.id -> profile name for active profiles
  const idToProfile = new Map<string, string>();
  for (const p of mgr.active_profiles) {
    for (const it of p.items) idToProfile.set(it.id, p.name);
  }

  // Plugins section
  if (pluginApplied.length > 0) {
    const lines = pluginApplied.map((d) => formatAppliedLine(d));
    sections.push({ title: "Plugins", lines });
  }

  // Profiles sections
  for (const p of mgr.profiles) {
    const matched = mgr.active_profiles.includes(p);
    const profLines = itemApplied
      .filter((d) => idToProfile.get(d.item.id) === p.name)
      .map((d) => formatAppliedLine(d));
    const matchNote = matched ? pc.green("✓ match") : pc.dim("✗ no match");
    const title = `Profile: ${p.name}  ${matchNote}`;
    sections.push({ title, lines: profLines });
  }

  return sections;
}

