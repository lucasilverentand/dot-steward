import type {
  AnalyzeIssue,
  AnalyzeReport,
  ManagedItem,
  ManagedItemId,
  Profile,
} from "@dot-steward/types";
import type { HostFacts } from "@dot-steward/types";
import { defaultHostFacts, evalMatcher } from "../matchers";
import { PluginRegistry } from "../plugins";

export interface AnalyzeInput {
  profiles: Profile[];
  host?: Parameters<typeof defaultHostFacts>[0];
}

export class AnalyzePhase {
  constructor(private readonly plugins?: PluginRegistry) {}
  run(input: AnalyzeInput): AnalyzeReport {
    const errors: AnalyzeIssue[] = [];
    const conflicts: AnalyzeIssue[] = [];
    const lints: AnalyzeIssue[] = [];

    const facts = defaultHostFacts(input.host);
    const matched = resolveMatchedProfiles(input.profiles, facts);

    // Validate that referenced plugins are registered
    if (this.plugins) {
      const checked = new Set<string>();
      for (const p of matched) {
        for (const pref of p.plugins ?? []) {
          const id = typeof pref === "string" ? pref : pref.id;
          if (checked.has(id)) continue;
          checked.add(id);
          if (!this.plugins.get(id)) {
            errors.push({
              code: "plugin.missing",
              message: `Plugin '${id}' is referenced but not loaded`,
              severity: "error",
            });
          }
        }
      }
    }

    // Detect duplicate item ids across matched profiles
    const seen = new Map<ManagedItemId, ManagedItem & { __profile?: string }>();
    for (const p of matched) {
      for (const it of p.items ?? []) {
        const prev = seen.get(it.id);
        if (prev && prev.owner !== it.owner) {
          conflicts.push({
            code: "item.duplicate_id",
            message: `Duplicate item id '${it.id}' across profiles '${prev.__profile}' and '${p.name}'`,
            severity: "error",
            itemId: it.id,
          });
        } else {
          const copy = { ...it, __profile: p.name } as ManagedItem & {
            __profile?: string;
          };
          seen.set(it.id, copy);
        }
      }
    }

    // Lint: empty profiles
    for (const p of matched) {
      if (!p.items?.length && !p.apps?.length && !p.plugins?.length) {
        lints.push({
          code: "profile.empty",
          message: `Profile '${p.name}' has no items/apps/plugins`,
          severity: "warning",
        });
      }
    }

    return { errors, conflicts, lints };
  }
}

function resolveMatchedProfiles(all: Profile[], facts?: Partial<HostFacts>) {
  const host = defaultHostFacts(facts);
  const byName = new Map(all.map((p) => [p.name, p] as const));
  const out: Profile[] = [];
  const visited = new Set<string>();

  function include(name: string) {
    if (visited.has(name)) return;
    visited.add(name);
    const p = byName.get(name);
    if (!p) return;
    for (const inc of p.includes ?? []) include(inc);
    if (evalMatcher(p.matcher, host)) out.push(p);
  }

  for (const p of all) include(p.name);
  // Stable order by priority then name
  out.sort(
    (a, b) =>
      (a.priority ?? 0) - (b.priority ?? 0) || a.name.localeCompare(b.name),
  );
  return out;
}
