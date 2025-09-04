import { Config, config } from "./config.ts";
import { DependencyGraph } from "./deps.ts";
import { type CoreEvents, EventBus } from "./events.ts";
import { HostContext } from "./host/context.ts";
import type { Item } from "./item.ts";
import { Plugin } from "./plugin.ts";
import type { Profile } from "./profile.ts";

export class Manager {
  readonly host = new HostContext();
  private _profiles: Profile[] = [];
  private _plugins: Plugin[] = [];
  readonly events = new EventBus<CoreEvents>();
  readonly deps = new DependencyGraph();

  async init(configPath: string) {
    await this.events.emit("manager:init_start", { config_url: configPath });
    // load config file dynamically from .ts file
    const cfg = (await import(configPath)).default;
    if (cfg instanceof Config) {
      // Attach event bus to items as they are registered
      for (const pr of cfg.profiles) {
        pr.attach_events(this.events);
        for (const it of pr.items) {
          it.attach_events(this.events);
        }
      }
      this.profiles.push(...cfg.profiles);
    } else {
      throw new Error("Invalid config file");
    }
    // init the host context
    await this.host.init();
    // Discover plugins referenced by items (either explicit Plugin items,
    // items that carry a `.plugin` reference, or items with plugin metadata)
    const discovered = new Map<string, Plugin>();
    const discoveredByKey = new Map<string, Plugin>();
    const itemToPlugin = new Map<string, Plugin>();
    for (const pr of this._profiles) {
      for (const it of pr.items) {
        // If the item itself is a Plugin instance, include it
        if ((it as unknown) instanceof Plugin) {
          const p = it as unknown as Plugin;
          discovered.set(p.id, p);
          // index by key (plugin name) for later lookups
          const key = (p as unknown as { name?: string }).name;
          if (key) discoveredByKey.set(key, p);
          continue;
        }
        const rec = it as unknown as {
          plugin?: unknown;
          plugin_key?: string;
          get_plugin_factory?: () => Plugin;
        };
        // If the item carries a `plugin` reference, include it
        if (rec.plugin && rec.plugin instanceof Plugin) {
          const p = rec.plugin as Plugin;
          discovered.set(p.id, p);
          const key = (p as unknown as { name?: string }).name;
          if (key) discoveredByKey.set(key, p);
          itemToPlugin.set(it.id, p);
          continue;
        }
        // Duck-typed metadata: plugin_key + get_plugin_factory()
        if (rec.plugin_key && typeof rec.get_plugin_factory === "function") {
          let p = discoveredByKey.get(rec.plugin_key);
          if (!p) {
            p = rec.get_plugin_factory();
            discovered.set(p.id, p);
            discoveredByKey.set(rec.plugin_key, p);
          }
          itemToPlugin.set(it.id, p);
        }
      }
    }
    // Attach events to discovered plugins and register them
    for (const p of discovered.values()) p.attach_events(this.events);
    this._plugins.push(...discovered.values());
    // Build dependency graph from plugins and profile items
    // Include plugins so that items can depend on their owning plugin
    if (this._plugins.length > 0) {
      this.deps.add_items(this._plugins as unknown as import("./item.ts").Item[]);
    }
    for (const pr of this._profiles) {
      this.deps.add_items(pr.items);
    }
    // Add edges from plugin -> item for items bound to a plugin
    for (const [itemId, plugin] of itemToPlugin) {
      this.deps.add_edge(plugin.id, itemId);
    }
    const validation = this.deps.validate();
    const stats = {
      items: this.deps.nodes.size,
      edges: this.deps.edges().length,
      roots: this.deps.roots(),
      missing: validation.missing,
      cycles: validation.cycles,
    };
    await this.events.emit("manager:deps_built", stats);
    await this.events.emit("manager:init_done", {
      profiles: this._profiles.length,
      plugins: this._plugins.length,
    });
  }

  get profiles(): Profile[] {
    return this._profiles;
  }

  get plugins(): Plugin[] {
    return this._plugins;
  }

  async analyze() {
    await this.events.emit("manager:analyze_start");
    // probe the plugins (items)
    for (const plugin of this.plugins) {
      await this.events.emit("item:probe_start", {
        item_id: plugin.id,
        kind: plugin.kind,
        name: plugin.name,
      });
      try {
        // Skip probe when host does not satisfy declared compatibility
        if (!this.host.evaluateMatch(plugin.matches)) {
          plugin.set_status("give-up");
          await this.events.emit("item:probe_done", {
            item_id: plugin.id,
            kind: plugin.kind,
            name: plugin.name,
            status: plugin.state.status,
          });
          continue;
        }
        const status = await plugin.probe(this.host);
        await this.events.emit("item:probe_done", {
          item_id: plugin.id,
          kind: plugin.kind,
          name: plugin.name,
          status,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await this.events.emit("item:probe_error", {
          item_id: plugin.id,
          kind: plugin.kind,
          name: plugin.name,
          error: msg,
        });
        throw err;
      }
    }
    await this.events.emit("manager:analyze_done");
  }

  topo_items(): Item[] {
    const order = this.deps.topo_order();
    const items: Item[] = [];
    for (const id of order) {
      const it = this.deps.nodes.get(id);
      if (it) items.push(it);
    }
    return items;
  }

  async apply(): Promise<void> {
    const items = this.topo_items();
    for (const it of items) {
      await this.events.emit("item:apply_start", {
        item_id: it.id,
        kind: it.kind,
        name: (it as { name?: string }).name,
      });
      try {
        // If item declares host compatibility, skip when not matched
        const matches = (it as { matches?: import("./host/matching.ts").HostMatchExpr }).matches;
        if (matches && !this.host.evaluateMatch(matches)) {
          // Mark as give-up if not already applied
          if (it.state.status !== "applied") it.set_status("give-up");
          await this.events.emit("item:apply_done", {
            item_id: it.id,
            kind: it.kind,
            name: (it as { name?: string }).name,
          });
          continue;
        }
        await it.apply(this.host);
        // Mark applied on success
        it.set_status("applied");
        await this.events.emit("item:apply_done", {
          item_id: it.id,
          kind: it.kind,
          name: (it as { name?: string }).name,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        it.set_status("failed", { error: msg });
        await this.events.emit("item:apply_error", {
          item_id: it.id,
          kind: it.kind,
          name: (it as { name?: string }).name,
          error: msg,
        });
        throw err;
      }
    }
  }

  async cleanup(): Promise<void> {
    const items = this.topo_items().slice().reverse();
    for (const it of items) {
      await this.events.emit("item:cleanup_start", {
        item_id: it.id,
        kind: it.kind,
        name: (it as { name?: string }).name,
      });
      try {
        // Skip cleanup if item is incompatible with host
        const matches = (it as { matches?: import("./host/matching.ts").HostMatchExpr }).matches;
        if (matches && !this.host.evaluateMatch(matches)) {
          await this.events.emit("item:cleanup_done", {
            item_id: it.id,
            kind: it.kind,
            name: (it as { name?: string }).name,
          });
          continue;
        }
        await it.cleanup(this.host);
        await this.events.emit("item:cleanup_done", {
          item_id: it.id,
          kind: it.kind,
          name: (it as { name?: string }).name,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await this.events.emit("item:cleanup_error", {
          item_id: it.id,
          kind: it.kind,
          name: (it as { name?: string }).name,
          error: msg,
        });
        throw err;
      }
    }
  }
}
