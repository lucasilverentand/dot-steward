import type {
  ActionNode,
  Diff,
  ManagedItem,
  ManagedItemId,
  Plan,
  PlanEdge,
  PlanHash,
  PlanHeader,
  Profile,
} from "@dot-steward/types";
import { defaultHostFacts, evalMatcher } from "../matchers";
import { PluginRegistry } from "../plugins";
import { hashString, stableStringify } from "../util/hash";

export interface PlanInput {
  profiles: Profile[];
  host?: Parameters<typeof defaultHostFacts>[0];
}

export class PlanPhase {
  constructor(private readonly plugins?: PluginRegistry) {}
  buildDAG(input: PlanInput): Plan {
    const facts = defaultHostFacts(input.host);
    const selected = selectItems(input.profiles, facts);

    const nodes: ActionNode[] = [];
    const edges: PlanEdge[] = [];

    for (const item of selected) {
      nodes.push(buildNode(item, this.plugins, facts));
      for (const dep of item.deps ?? []) {
        edges.push({ from: nodeId(dep), to: nodeId(item.id), type: "dep" });
      }
    }

    type BunLike = { version?: string };
    const bun = (globalThis as unknown as { Bun?: BunLike }).Bun;
    const engine = bun?.version
      ? { name: "bun", version: bun.version }
      : process?.versions?.node
        ? { name: "node", version: process.versions.node }
        : undefined;
    const header: PlanHeader = {
      createdAt: new Date().toISOString(),
      engine: engine as PlanHeader["engine"],
      profiles: uniqueProfilesFromSelection(input.profiles, facts),
      description: "Draft plan (no-op actions)",
    };
    const previews: Diff[] = nodes.map((n) => n.diff);
    const hash = computePlanHash({ header, nodes, edges, previews });

    return { header, nodes, edges, previews, hash };
  }
}

function selectItems(
  profiles: Profile[],
  facts: ReturnType<typeof defaultHostFacts>,
) {
  const out: ManagedItem[] = [];
  for (const p of profiles) {
    if (evalMatcher(p.matcher, facts)) {
      out.push(...(p.items ?? []));
    }
  }
  return out;
}

function uniqueProfilesFromSelection(
  profiles: Profile[],
  facts: ReturnType<typeof defaultHostFacts>,
) {
  return profiles
    .filter((p) => evalMatcher(p.matcher, facts))
    .map((p) => p.name)
    .sort((a, b) => a.localeCompare(b));
}

function buildNode(
  item: ManagedItem,
  plugins: PluginRegistry | undefined,
  facts: ReturnType<typeof defaultHostFacts>,
): ActionNode {
  let diff: Diff = {
    current: null,
    desired: item.spec,
    idempotent: true,
    changes: [],
  };
  let pluginId: string | undefined;
  let capabilityId: string | undefined;
  const ctx = { host: facts, env: facts.env };
  if (plugins) {
    const p = resolvePluginForItem(item, plugins, facts);
    if (p) {
      try {
        pluginId = p.id;
        capabilityId = findCapabilityForKind(p, item.kind);
        const capHandlers = capabilityId
          ? p.capabilityHandlers?.[capabilityId]
          : undefined;
        const handler = capHandlers?.diff ?? p.handlers.diff;
        if (handler) {
          diff = handler(undefined, item.spec, ctx) as Diff;
        }
      } catch {
        // keep fallback diff
      }
    }
  }
  return {
    id: nodeId(item.id),
    itemId: item.id,
    pluginId,
    capabilityId,
    action: pluginId ? "ensure" : "noop",
    diff,
    locks: [],
    metadata: { kind: item.kind, spec: item.spec },
  };
}

function nodeId(id: ManagedItemId) {
  return `node:${id}`;
}

export function computePlanHash(obj: {
  header: PlanHeader;
  nodes: ActionNode[];
  edges: PlanEdge[];
  previews?: Diff[];
}): PlanHash {
  // Exclude volatile fields from the hash (e.g., createdAt)
  const normalized = {
    ...obj,
    header: {
      ...obj.header,
      createdAt: "", // ignore timestamp for deterministic hash
    },
  };
  return hashString(stableStringify(normalized));
}

function resolvePluginForItem(
  item: ManagedItem,
  plugins: PluginRegistry,
  facts: ReturnType<typeof defaultHostFacts>,
) {
  // If owner is set, prefer that plugin id
  if (item.owner) {
    const p = plugins.get(item.owner);
    if (p) return p;
  }
  const ctx = { host: facts, env: facts.env };
  const supporting = plugins.findSupporting(item, ctx);
  if (supporting) return supporting;
  // Simple routing for packages: brew on macOS, apt on Debian/Ubuntu
  if (item.kind === "package") {
    if (facts.os === "darwin") return plugins.get("brew");
    if (facts.os === "linux" && /debian|ubuntu/i.test(facts.distro ?? ""))
      return plugins.get("apt");
  }
  return undefined;
}

function findCapabilityForKind(
  plugin: {
    manifest: { capabilities: { id: string; provides: (string | never)[] }[] };
  },
  kind: string,
): string | undefined {
  for (const cap of plugin.manifest.capabilities ?? []) {
    const provides = Array.isArray(cap.provides) ? cap.provides : [];
    if (provides.includes(kind)) return cap.id;
  }
  return undefined;
}
