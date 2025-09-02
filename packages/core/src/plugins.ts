import type { ManagedItem, Plugin } from "@dot-steward/types";
import type { HostFacts } from "@dot-steward/types";

export class PluginRegistry {
  private readonly byId = new Map<string, Plugin>();

  constructor(plugins: Plugin[] = []) {
    this.registerMany(plugins);
  }

  register(plugin: Plugin) {
    this.byId.set(plugin.id, plugin);
  }

  registerMany(plugins: Plugin[]) {
    for (const p of plugins) this.register(p);
  }

  get(id: string): Plugin | undefined {
    return this.byId.get(id);
  }

  list(): Plugin[] {
    return Array.from(this.byId.values());
  }

  findSupporting(
    item: ManagedItem,
    ctx: { host: HostFacts; env?: Record<string, string | undefined> },
  ): Plugin | undefined {
    for (const p of this.byId.values()) {
      try {
        if (p.supports && p.supports(item, ctx)) return p;
      } catch {
        // ignore plugin errors during support probing
      }
    }
    return undefined;
  }
}
