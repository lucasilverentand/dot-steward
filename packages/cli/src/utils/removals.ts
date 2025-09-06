import type { Manager } from "@dot-steward/core";
import type { LastApply } from "../state.ts";

export type RemovalCandidate = {
  id: string;
  kind: string;
  label: string;
  summary?: string;
  profile?: string;
};

/**
 * Compute items that should be considered for removal by comparing the
 * last successful apply state to the current plan decisions.
 *
 * Matching heuristic: we use the item's render() label as the stable key,
 * since item ids are ephemeral across runs. Items whose labels are present
 * in the current decisions with action !== "skip" are considered desired
 * to keep; the rest from lastApply are candidates for removal.
 */
export function computeRemovedSinceLastApply(
  mgr: Manager,
  decisions: Awaited<ReturnType<Manager["plan"]>>,
  lastApply: LastApply | undefined,
  configPath: string,
): RemovalCandidate[] {
  if (!lastApply) return [];
  // Only consider lastApply that matches this config and host
  const sameConfig = lastApply.configPath === configPath;
  const sameHost =
    lastApply.host.os === mgr.host.os &&
    lastApply.host.arch === mgr.host.arch &&
    lastApply.host.home === mgr.host.user.home;
  if (!sameConfig || !sameHost) return [];

  // Build the set of labels we intend to keep (apply or noop)
  const keep = new Set<string>();
  for (const d of decisions) {
    if (d.action === "apply" || d.action === "noop") {
      keep.add(d.item.render());
    }
  }
  // Return items that were previously applied but are no longer desired
  // Preserve original "applied" order for dependency semantics, then reverse
  // it so dependents are removed before their dependencies (e.g., remove
  // App Store apps before uninstalling the `mas` brew formula they rely on).
  return (lastApply.applied || [])
    .filter((a) => a.kind !== "plugin")
    .filter((a) => !keep.has(a.label))
    .reverse();
}

export function formatRemovalsSection(
  removed: RemovalCandidate[],
): { title: string; lines: string[] } | null {
  if (!removed || removed.length === 0) return null;
  const RED = "\x1b[31m";
  const RESET = "\x1b[0m";
  const lines = removed.map((r) => `${RED}! ${r.label}${RESET}`);
  return { title: "Removals (from last apply)", lines };
}

// Build a map from profile name to removal lines for inline rendering
export function buildRemovalLinesByProfile(
  removed: RemovalCandidate[],
): Map<string, string[]> {
  const RED = "\x1b[31m";
  const RESET = "\x1b[0m";
  const map = new Map<string, string[]>();
  for (const r of removed) {
    const prof = r.profile || "(previous)";
    const line = `${RED}! ${r.label}${RESET}`;
    const arr = map.get(prof) || [];
    arr.push(line);
    map.set(prof, arr);
  }
  return map;
}
