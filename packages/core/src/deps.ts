import type { Item } from "./item.ts";
import { ItemSchema } from "./item.ts";

export type DepEdge = { from: string; to: string };

export class DependencyGraph {
  readonly nodes: Map<string, Item> = new Map();
  // edges: dependency -> dependent (i.e., from required to requiring)
  readonly outgoing: Map<string, Set<string>> = new Map();
  readonly incoming: Map<string, Set<string>> = new Map();

  add_items(items: Item[]): this {
    const dev = process.env.NODE_ENV !== "production";
    for (const it of items) {
      if (dev) {
        // Validate item shape in dev to catch schema mismatches early
        try {
          ItemSchema.parse(it);
        } catch (err) {
          const id = (it as { id?: string }).id ?? "<unknown>";
          throw new Error(
            `Invalid item ${id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      this.nodes.set(it.id, it);
      if (!this.outgoing.has(it.id)) this.outgoing.set(it.id, new Set());
      if (!this.incoming.has(it.id)) this.incoming.set(it.id, new Set());
    }
    for (const it of items) {
      for (const dep of it.requires) {
        // Create missing node slots; will be flagged in validate()
        if (!this.outgoing.has(dep)) this.outgoing.set(dep, new Set());
        if (!this.incoming.has(dep)) this.incoming.set(dep, new Set());
        this.outgoing.get(dep)?.add(it.id);
        this.incoming.get(it.id)?.add(dep);
      }
    }
    return this;
  }

  all_items(): Item[] {
    return Array.from(this.nodes.values());
  }

  roots(): string[] {
    // items with no incoming edges (no requirements) OR whose dependencies are unknown
    const ids = new Set(this.nodes.keys());
    const roots: string[] = [];
    for (const id of ids) {
      const incoming = this.incoming.get(id);
      if (!incoming || incoming.size === 0) {
        roots.push(id);
      }
    }
    return roots;
  }

  edges(): DepEdge[] {
    const list: DepEdge[] = [];
    for (const [from, tos] of this.outgoing) {
      for (const to of tos) list.push({ from, to });
    }
    return list;
  }

  add_edge(from: string, to: string): this {
    if (!this.outgoing.has(from)) this.outgoing.set(from, new Set());
    if (!this.incoming.has(from)) this.incoming.set(from, new Set());
    if (!this.outgoing.has(to)) this.outgoing.set(to, new Set());
    if (!this.incoming.has(to)) this.incoming.set(to, new Set());
    this.outgoing.get(from)?.add(to);
    this.incoming.get(to)?.add(from);
    return this;
  }

  validate(): { missing: string[]; cycles: string[][] } {
    const missing: string[] = [];
    for (const [id, deps] of this.incoming) {
      for (const dep of deps) {
        if (!this.nodes.has(dep)) missing.push(dep);
      }
    }

    // Detect cycles via Kahn's algorithm
    const indeg = new Map<string, number>();
    for (const id of this.outgoing.keys()) indeg.set(id, 0);
    for (const id of this.nodes.keys()) if (!indeg.has(id)) indeg.set(id, 0);
    for (const [_, deps] of this.incoming) {
      for (const dep of deps) indeg.set(dep, indeg.get(dep) ?? 0);
    }
    for (const [id, deps] of this.incoming) {
      indeg.set(id, deps.size);
    }

    const queue: string[] = [];
    for (const [id, d] of indeg) if (d === 0) queue.push(id);
    const order: string[] = [];
    const out = this.outgoing;
    const indegWork = new Map(indeg);
    while (queue.length > 0) {
      const n = queue.shift();
      if (n === undefined) break;
      order.push(n);
      const tos = out.get(n);
      if (!tos) continue;
      for (const m of tos) {
        const d = (indegWork.get(m) ?? 0) - 1;
        indegWork.set(m, d);
        if (d === 0) queue.push(m);
      }
    }
    const cycles: string[][] = [];
    if (order.length !== indeg.size) {
      // Extract nodes still with indegree > 0 as part of cycles
      const inCycle = new Set<string>();
      for (const [id, d] of indegWork) if ((d ?? 0) > 0) inCycle.add(id);
      // Try to break into simple cycles (best effort)
      for (const start of inCycle) {
        if (!inCycle.has(start)) continue;
        const cycle: string[] = [start];
        let cur = start;
        const visited = new Set<string>([start]);
        while (true) {
          const preds = this.incoming.get(cur);
          if (!preds) break;
          const next = Array.from(preds).find((p) => inCycle.has(p));
          if (!next) break;
          if (visited.has(next)) {
            cycle.push(next);
            break;
          }
          cycle.push(next);
          visited.add(next);
          cur = next;
        }
        cycles.push(cycle);
        for (const n of cycle) inCycle.delete(n);
      }
    }
    return { missing, cycles };
  }

  topo_order(): string[] {
    // Kahn's algorithm to produce a topological order of known nodes
    const indeg = new Map<string, number>();
    for (const [id, deps] of this.incoming) indeg.set(id, deps.size);
    for (const id of this.nodes.keys()) if (!indeg.has(id)) indeg.set(id, 0);

    const queue: string[] = [];
    for (const [id, d] of indeg) if (d === 0) queue.push(id);
    const order: string[] = [];
    const out = this.outgoing;
    const indegWork = new Map(indeg);
    while (queue.length > 0) {
      const n = queue.shift();
      if (n === undefined) break;
      if (this.nodes.has(n)) order.push(n);
      const tos = out.get(n);
      if (!tos) continue;
      for (const m of tos) {
        const d = (indegWork.get(m) ?? 0) - 1;
        indegWork.set(m, d);
        if (d === 0) queue.push(m);
      }
    }
    return order;
  }
}
