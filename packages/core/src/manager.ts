import { Config, ConfigSchema } from "./config.ts";
import { DependencyGraph } from "./deps.ts";
import { type CoreEvents, EventBus, validateCoreEvent } from "./events.ts";
import { HostContext } from "./host/context.ts";
import type { Item } from "./item.ts";
import { Plugin } from "./plugin.ts";
import type { Profile } from "./profile.ts";

export class Manager {
  readonly host = new HostContext();
  private _profiles: Profile[] = [];
  private _activeProfiles: Profile[] = [];
  private _plugins: Plugin[] = [];
  readonly events = new EventBus<CoreEvents>();
  readonly deps = new DependencyGraph();

  constructor() {
    // Enable dev-time event payload validation when not production
    if (process.env.NODE_ENV !== "production") {
      this.events.setValidator((event, payload) => {
        validateCoreEvent(event as keyof CoreEvents, payload);
      });
    }
  }

  async init(configPath: string) {
    await this.events.emit("manager:init_start", { config_url: configPath });
    // load config file dynamically from .ts file
    const cfg = (await import(configPath)).default;
    // Accept both instances and plain objects via schema validation
    let profiles: Profile[] | undefined;
    if (cfg instanceof Config) {
      profiles = cfg.profiles;
    } else {
      const res = ConfigSchema.safeParse(cfg);
      if (
        res.success &&
        Array.isArray((cfg as { profiles?: unknown }).profiles)
      ) {
        profiles = (cfg as { profiles: Profile[] }).profiles;
      }
    }
    if (!profiles)
      throw new Error(
        "Invalid config file: expected default export with profiles[]",
      );
    // store all profiles (for diagnostics/UI), but operate on active ones
    this._profiles = [...profiles];
    // init the host context before evaluating matches
    await this.host.init();
    this._activeProfiles = this._profiles.filter((p) =>
      this.host.evaluateMatch(p.matches),
    );
    // Discover plugins referenced by items across ALL profiles so that
    // automatic plugin usage (via plugin_key/get_plugin_factory) is visible
    // in diagnostics like `analyze`, regardless of which profiles are active
    // on the current host. Dependency edges will still be restricted to
    // active profiles to avoid spurious graph nodes.
    const discovered = new Map<string, Plugin>();
    const discoveredByKey = new Map<string, Plugin>();
    const itemToPlugin = new Map<string, Plugin>();

    // Helper that inspects an item and, if it refers to a plugin in any of the
    // supported ways, records that plugin into the discovery maps.
    const discoverFromItem = (
      it: import("./item.ts").Item,
      recordBinding: boolean,
    ) => {
      // If the item itself is a Plugin instance, include it
      if ((it as unknown) instanceof Plugin) {
        const p = it as unknown as Plugin;
        discovered.set(p.id, p);
        // index by key (plugin name) for later lookups
        const key = (p as unknown as { name?: string }).name;
        if (key) discoveredByKey.set(key, p);
        // A plugin item does not bind as an owning plugin for itself
        return;
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
        if (recordBinding) itemToPlugin.set(it.id, p);
        return;
      }
      // Duck-typed metadata: plugin_key + get_plugin_factory()
      if (rec.plugin_key && typeof rec.get_plugin_factory === "function") {
        let p = discoveredByKey.get(rec.plugin_key);
        if (!p) {
          p = rec.get_plugin_factory();
          discovered.set(p.id, p);
          discoveredByKey.set(rec.plugin_key, p);
        }
        if (recordBinding) itemToPlugin.set(it.id, p);
      }
    };

    // Attach events to ACTIVE profiles and their items (only those relevant to host)
    for (const pr of this._activeProfiles) {
      pr.attach_events(this.events);
      for (const it of pr.items) it.attach_events(this.events);
    }

    // Discover plugins from ALL profiles (active + inactive)
    for (const pr of this._profiles) {
      for (const it of pr.items) discoverFromItem(it, /*recordBinding*/ false);
    }

    // Record plugin bindings for ACTIVE profile items only (for dep edges)
    for (const pr of this._activeProfiles) {
      for (const it of pr.items) discoverFromItem(it, /*recordBinding*/ true);
    }
    // Attach events to discovered plugins and register them
    for (const p of discovered.values()) p.attach_events(this.events);
    this._plugins.push(...discovered.values());
    // Build dependency graph from plugins and profile items
    // Include plugins so that items can depend on their owning plugin
    if (this._plugins.length > 0) {
      this.deps.add_items(
        this._plugins as unknown as import("./item.ts").Item[],
      );
    }
    for (const pr of this._activeProfiles) {
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
      profiles: this._activeProfiles.length,
      plugins: this._plugins.length,
    });
  }

  get profiles(): Profile[] {
    return this._profiles;
  }

  get plugins(): Plugin[] {
    return this._plugins;
  }

  get active_profiles(): Profile[] {
    return this._activeProfiles;
  }

  async analyze() {
    await this.events.emit("manager:analyze_start");
    const errors: Array<{ id: string; error: string }> = [];
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
        errors.push({ id: plugin.id, error: msg });
      }
    }
    await this.events.emit("manager:analyze_done");
    if (errors.length > 0)
      throw new AggregateError(
        errors.map((e) => new Error(`${e.id}: ${e.error}`)),
        "Analyze encountered errors",
      );
  }

  // Plan the apply stage: produce a list of actions that would be taken
  // without performing any changes.
  async plan(): Promise<
    Array<{
      item: Item;
      action: "apply" | "skip" | "noop";
      reason?: string;
      details?: import("./item.ts").ItemPlan | null;
    }>
  > {
    await this.events.emit("manager:plan_start");
    const items = this.topo_items();
    const decisions: Array<{
      item: Item;
      action: "apply" | "skip" | "noop";
      reason?: string;
      details?: import("./item.ts").ItemPlan | null;
    }> = [];
    let toApply = 0;
    let skipped = 0;
    let noop = 0;
    for (const it of items) {
      const name = (it as { name?: string }).name;
      const matches = (
        it as {
          matches?: import("./host/matching.ts").HostMatchExpr;
        }
      ).matches;
      const compatible = matches ? this.host.evaluateMatch(matches) : true;
      let action: "apply" | "skip" | "noop";
      let reason: string | undefined;
      if (!compatible) {
        action = "skip";
        reason = "incompatible host";
        skipped++;
      } else if (it.state.status === "applied") {
        action = "noop";
        reason = "already applied";
        noop++;
      } else {
        action = "apply";
        toApply++;
      }
      let details: import("./item.ts").ItemPlan | null | undefined;
      try {
        details = await it.plan(this.host);
      } catch {
        details = undefined;
      }
      decisions.push({ item: it, action, reason, details });
      await this.events.emit("item:plan_decision", {
        item_id: it.id,
        kind: it.kind,
        name,
        action,
        reason,
        summary: details?.summary,
      });
    }
    await this.events.emit("manager:plan_done", {
      items: items.length,
      to_apply: toApply,
      skipped,
      noop,
    });
    return decisions;
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
    const errors: Array<{ id: string; error: string }> = [];
    for (const it of items) {
      await this.events.emit("item:apply_start", {
        item_id: it.id,
        kind: it.kind,
        name: (it as { name?: string }).name,
      });
      try {
        // If item declares host compatibility, skip when not matched
        const matches = (
          it as { matches?: import("./host/matching.ts").HostMatchExpr }
        ).matches;
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
        errors.push({ id: it.id, error: msg });
      }
    }
    if (errors.length > 0)
      throw new AggregateError(
        errors.map((e) => new Error(`${e.id}: ${e.error}`)),
        "Apply encountered errors",
      );
  }

  async cleanup(): Promise<void> {
    const items = this.topo_items().slice().reverse();
    const errors: Array<{ id: string; error: string }> = [];
    for (const it of items) {
      await this.events.emit("item:cleanup_start", {
        item_id: it.id,
        kind: it.kind,
        name: (it as { name?: string }).name,
      });
      try {
        // Skip cleanup if item is incompatible with host
        const matches = (
          it as { matches?: import("./host/matching.ts").HostMatchExpr }
        ).matches;
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
        errors.push({ id: it.id, error: msg });
      }
    }
    if (errors.length > 0)
      throw new AggregateError(
        errors.map((e) => new Error(`${e.id}: ${e.error}`)),
        "Cleanup encountered errors",
      );
  }
}
