import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { Manager } from "@dot-steward/core";

export type SavedDecision = {
  item_id: string;
  action: "apply" | "skip" | "noop";
  reason?: string;
  summary?: string;
};

export type LastPlan = {
  configPath: string;
  host: { os: string | null; arch: string | null; home: string | null };
  at: string; // ISO timestamp
  decisions: SavedDecision[];
};

export type LastApply = {
  configPath: string;
  host: { os: string | null; arch: string | null; home: string | null };
  at: string; // ISO timestamp
  applied: Array<{ id: string; kind: string; label: string; summary?: string }>; // items that were applied
};

export type CLIState = {
  version: 1;
  lastPlan?: LastPlan;
  lastApply?: LastApply;
};

function stateBaseDir(): string {
  // Persist CLI state under the user's home: ~/.dot-steward
  // Allow overriding the base directory via DOT_STEWARD_HOME for advanced setups.
  const home = os.homedir();
  return process.env.DOT_STEWARD_HOME || path.join(home, ".dot-steward");
}

function legacyStatePath(): string {
  return path.join(stateBaseDir(), "state.json");
}

function lastPlanPath(): string {
  return path.join(stateBaseDir(), "last-plan.json");
}

function lastApplyPath(): string {
  return path.join(stateBaseDir(), "last-apply.json");
}

export async function loadState(): Promise<CLIState> {
  const out: CLIState = { version: 1 };
  // Prefer split files
  try {
    const data = await fs.readFile(lastPlanPath(), "utf8");
    out.lastPlan = JSON.parse(data) as LastPlan;
  } catch {}
  try {
    const data = await fs.readFile(lastApplyPath(), "utf8");
    out.lastApply = JSON.parse(data) as LastApply;
  } catch {}
  if (!out.lastPlan && !out.lastApply) {
    // Fallback: read legacy single-file state if present (no migration)
    try {
      const legacy = await fs.readFile(legacyStatePath(), "utf8");
      const parsed = JSON.parse(legacy) as CLIState;
      if (parsed && parsed.version === 1) {
        out.lastPlan = parsed.lastPlan;
        out.lastApply = parsed.lastApply;
      }
    } catch {}
  }
  return out;
}

export async function saveState(state: CLIState): Promise<void> {
  const dir = stateBaseDir();
  await fs.mkdir(dir, { recursive: true });
  const hasOwn = (k: keyof CLIState) =>
    Object.prototype.hasOwnProperty.call(state, k);
  // Write or remove last plan
  if (hasOwn("lastPlan")) {
    if (state.lastPlan) {
      const data = `${JSON.stringify(state.lastPlan, null, 2)}\n`;
      await fs.writeFile(lastPlanPath(), data, "utf8");
    } else {
      try {
        await fs.rm(lastPlanPath(), { force: true });
      } catch {}
    }
  }
  // Write or remove last apply
  if (hasOwn("lastApply")) {
    if (state.lastApply) {
      const data = `${JSON.stringify(state.lastApply, null, 2)}\n`;
      await fs.writeFile(lastApplyPath(), data, "utf8");
    } else {
      try {
        await fs.rm(lastApplyPath(), { force: true });
      } catch {}
    }
  }
}

export function hostKey(mgr: Manager): {
  os: string | null;
  arch: string | null;
  home: string | null;
} {
  return { os: mgr.host.os, arch: mgr.host.arch, home: mgr.host.user.home };
}

export function decisionsToSaved(
  d: Awaited<ReturnType<Manager["plan"]>>,
): SavedDecision[] {
  return d.map((x) => ({
    item_id: x.item.id,
    action: x.action,
    reason: x.reason,
    summary: x.details?.summary,
  }));
}
