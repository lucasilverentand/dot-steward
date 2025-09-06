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
    // Enable event payload validation
    this.events.setValidator((event, payload) => {
      validateCoreEvent(event as keyof CoreEvents, payload);
    });
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
    // Track plugin->plugin usage edges (used -> user)
    const pluginEdges: Array<{ from: string; to: string }> = [];

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
    // Discover plugin-to-plugin usages declared via get_used_plugins() on plugins
    // Iterate breadth-first to resolve transitive used plugins.
    const queue: Plugin[] = Array.from(discovered.values());
    const seenPluginIds = new Set(queue.map((p) => p.id));
    while (queue.length > 0) {
      const user = queue.shift(); // plugin that may use others
      if (!user) break;
      const uses = (
        user as unknown as {
          get_used_plugins?: () => Array<{
            key: string;
            get_plugin_factory: () => Plugin;
            assign?: (p: Plugin) => void;
          }>;
        }
      ).get_used_plugins?.();
      if (!uses || uses.length === 0) continue;
      for (const u of uses) {
        let dep = discoveredByKey.get(u.key);
        if (!dep) {
          dep = u.get_plugin_factory();
          discovered.set(dep.id, dep);
          discoveredByKey.set(u.key, dep);
          if (!seenPluginIds.has(dep.id)) {
            queue.push(dep);
            seenPluginIds.add(dep.id);
          }
        }
        // inject instance if requested
        try {
          u.assign?.(dep);
        } catch {
          // ignore injection errors
        }
        pluginEdges.push({ from: dep.id, to: user.id });
      }
    }
    // Attach events to discovered plugins and register them
    for (const p of discovered.values()) p.attach_events(this.events);
    this._plugins.push(...discovered.values());
    // Build dependency graph from plugins and profile items
    // Include plugins so that items can depend on their owning plugin
    // Before adding, deduplicate compatible items that declare a stable dedupe key
    const profileItemsRaw = this._activeProfiles.flatMap((p) => p.items);
    type DedupeKeyFn = () => string;
    const getKey = (it: import("./item.ts").Item): string | null => {
      const f = (it as unknown as { dedupe_key?: DedupeKeyFn }).dedupe_key;
      if (typeof f === "function") {
        try {
          const k = f.call(it);
          if (typeof k === "string" && k.length > 0) return k;
        } catch {
          // ignore bad keys
        }
      }
      return null;
    };
    const keyToCanonical = new Map<string, import("./item.ts").Item>();
    const idMap = new Map<string, string>(); // duplicate id -> canonical id
    for (const it of profileItemsRaw) {
      const key = getKey(it);
      if (!key) continue;
      const canonical = keyToCanonical.get(key);
      if (!canonical) keyToCanonical.set(key, it);
      else {
        idMap.set(it.id, canonical.id);
      }
    }
    // Rewrite requires for all profile items to point to canonical ids when applicable
    for (const it of profileItemsRaw) {
      if (!it.requires || it.requires.length === 0) continue;
      for (let i = 0; i < it.requires.length; i++) {
        const cur = it.requires[i];
        const canon = idMap.get(cur);
        if (canon && canon !== cur) it.requires[i] = canon;
      }
    }
    // Filter out duplicate items (keep only canonical or items without key)
    const duplicateIds = new Set(idMap.keys());
    const profileItems = profileItemsRaw.filter(
      (it) => !duplicateIds.has(it.id),
    );

    if (this._plugins.length > 0)
      this.deps.add_items(
        this._plugins as unknown as import("./item.ts").Item[],
      );
    if (profileItems.length > 0) this.deps.add_items(profileItems);
    // Add edges from plugin -> item for items bound to a plugin (after canonicalization)
    for (const [itemId, plugin] of itemToPlugin) {
      const canon = idMap.get(itemId) ?? itemId;
      this.deps.add_edge(plugin.id, canon);
    }
    // Add edges from used plugin -> user plugin
    for (const e of pluginEdges) this.deps.add_edge(e.from, e.to);
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

  // analyze() removed; probing happens inline in plan/apply/upgrade when needed

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
    // Probe compatible items up-front so we can accurately decide noop/apply
    for (const it of items) {
      const name = (it as { name?: string }).name;
      const matches = (
        it as {
          matches?: import("./host/matching.ts").HostMatchExpr;
        }
      ).matches;
      const compatible = matches ? this.host.evaluateMatch(matches) : true;
      if (!compatible) continue;
      await this.events.emit("item:probe_start", {
        item_id: it.id,
        kind: it.kind,
        name,
      });
      try {
        const st = await it.probe(this.host);
        await this.events.emit("item:probe_done", {
          item_id: it.id,
          kind: it.kind,
          name,
          status: st,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await this.events.emit("item:probe_error", {
          item_id: it.id,
          kind: it.kind,
          name,
          error: msg,
        });
      }
    }
    // Track items that failed validation so we can skip their dependents.
    const invalid = new Set<string>();
    const decisions: Array<{
      item: Item;
      action: "apply" | "skip" | "noop";
      reason?: string;
      details?: import("./item.ts").ItemPlan | null;
    }> = [];
    const errors: Array<{ id: string; error: string }> = [];
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
      const blockedByInvalidDep = it.requires?.some((dep) => invalid.has(dep));
      let action: "apply" | "skip" | "noop";
      let reason: string | undefined;
      if (!compatible) {
        action = "skip";
        reason = "incompatible host";
      } else if (blockedByInvalidDep) {
        action = "skip";
        reason = "blocked: invalid dependency";
      } else if (it.state.status === "applied") {
        action = "noop";
        reason = "already applied";
      } else {
        action = "apply";
      }
      // Validate item configuration/preconditions during plan stage
      try {
        // Only validate when we intend to apply (i.e., compatible and not blocked)
        if (action === "apply") await it.validate(this.host);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ id: it.id, error: msg });
        invalid.add(it.id);
        // Mark decision as skipped with reason; still attempt to render plan summary
        action = "skip";
        reason = `invalid: ${msg}`;
      }
      let details: import("./item.ts").ItemPlan | null | undefined;
      try {
        details = await it.plan(this.host);
      } catch {
        details = undefined;
      }
      decisions.push({ item: it, action, reason, details });
      // Count after final action is determined
      if (action === "apply") toApply++;
      else if (action === "noop") noop++;
      else if (action === "skip") skipped++;
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

  async apply(opts?: {
    skipUpdates?: boolean;
    concurrency?: number;
    forceApply?: boolean;
  }): Promise<void> {
    const wantAutoUpdate = !opts?.skipUpdates;
    const forceApply = !!opts?.forceApply;
    const maxConcurrency = Math.max(1, opts?.concurrency ?? 4);
    const errors: Array<{ id: string; error: string }> = [];
    // Establish current state before planning application, so we can skip
    // already-applied items and respect external state.
    const allItems = this.topo_items();
    for (const it of allItems) {
      const name = (it as { name?: string }).name;
      const matches = (
        it as { matches?: import("./host/matching.ts").HostMatchExpr }
      ).matches;
      const compatible = matches ? this.host.evaluateMatch(matches) : true;
      if (!compatible) continue;
      await this.events.emit("item:probe_start", {
        item_id: it.id,
        kind: it.kind,
        name,
      });
      try {
        const st = await it.probe(this.host);
        await this.events.emit("item:probe_done", {
          item_id: it.id,
          kind: it.kind,
          name,
          status: st,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await this.events.emit("item:probe_error", {
          item_id: it.id,
          kind: it.kind,
          name,
          error: msg,
        });
      }
    }
    // Build dependency tracking: unmet deps count initialized to number of
    // dependencies that are not currently applied.
    const unmet = new Map<string, number>();
    for (const [id, deps] of this.deps.incoming) {
      let cnt = 0;
      for (const d of deps) {
        const dep = this.deps.nodes.get(d);
        if (!dep || dep.state.status !== "applied") cnt++;
      }
      unmet.set(id, cnt);
    }
    for (const id of this.deps.nodes.keys())
      if (!unmet.has(id)) unmet.set(id, 0);

    const ready: string[] = [];
    for (const [id, cnt] of unmet) if (cnt === 0) ready.push(id);
    const processed = new Set<string>();
    let running = 0;

    // Per-plugin serialized queues (e.g., brew cannot run concurrently)
    const groupLocks = new Map<string, Promise<unknown>>();
    const runExclusive = async (
      group: string | undefined,
      fn: () => Promise<void>,
    ): Promise<void> => {
      if (!group) return fn();
      const last = groupLocks.get(group) ?? Promise.resolve();
      const next = last.then(fn);
      // Store a silenced continuation so the chain doesn't break on rejection
      groupLocks.set(
        group,
        next.catch(() => undefined),
      );
      return next;
    };

    const finishOne = (id: string, applied: boolean) => {
      processed.add(id);
      if (applied) {
        const outs = this.deps.outgoing.get(id);
        if (outs) {
          for (const m of outs) {
            const cur = unmet.get(m) ?? 0;
            const next = Math.max(0, cur - 1);
            unmet.set(m, next);
            if (next === 0 && !processed.has(m)) ready.push(m);
          }
        }
      }
    };

    const runItem = async (id: string) => {
      const it = this.deps.nodes.get(id);
      if (!it) return finishOne(id, false);
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
          // Mark as give-up if not already applied and emit a skip notification
          if (it.state.status !== "applied") it.set_status("give-up");
          await this.events.emit("item:apply_skip", {
            item_id: it.id,
            kind: it.kind,
            name: (it as { name?: string }).name,
            reason: "incompatible host",
          });
          finishOne(id, false);
          return;
        }

        const wasAppliedBefore = it.state.status === "applied";
        const pluginKey = (it as unknown as { plugin_key?: string }).plugin_key;
        // Validate preconditions before applying (do not retry on validation errors)
        await it.validate(this.host);
        if (forceApply || !wasAppliedBefore) {
          // Try applying with retries up to the item's limit
          let applied = false;
          while (!applied) {
            try {
              await runExclusive(
                pluginKey === "brew" ? "brew" : undefined,
                async () => {
                  await it.apply(this.host);
                },
              );
              it.reset_attempts();
              it.set_status("applied");
              it.clear_waits();
              applied = true;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              it.increment_attempts();
              it.set_status("failed", { error: msg });
              if (it.can_retry) {
                // retry
              } else {
                it.set_status("give-up", { error: msg });
                throw err;
              }
            }
          }
        }

        await this.events.emit("item:apply_done", {
          item_id: it.id,
          kind: it.kind,
          name: (it as { name?: string }).name,
        });

        // Auto-upgrade path: if item supports upgrades, check and perform
        if (wantAutoUpdate) {
          try {
            // Only consider upgrades for items that are applied now
            const needs = await it.has_upgrade(this.host);
            if (needs) {
              await this.events.emit("item:upgrade_start", {
                item_id: it.id,
                kind: it.kind,
                name: (it as { name?: string }).name,
              });
              let done = false;
              while (!done) {
                try {
                  await runExclusive(
                    pluginKey === "brew" ? "brew" : undefined,
                    async () => {
                      await it.upgrade(this.host);
                    },
                  );
                  it.reset_attempts();
                  // remains applied
                  await this.events.emit("item:upgrade_done", {
                    item_id: it.id,
                    kind: it.kind,
                    name: (it as { name?: string }).name,
                  });
                  done = true;
                } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e);
                  it.increment_attempts();
                  if (it.can_retry) {
                    // retry
                  } else {
                    await this.events.emit("item:upgrade_error", {
                      item_id: it.id,
                      kind: it.kind,
                      name: (it as { name?: string }).name,
                      error: msg,
                    });
                    break;
                  }
                }
              }
            } else if (wasAppliedBefore) {
              // Only emit skip when we actually checked upgrade for pre-installed items
              await this.events.emit("item:upgrade_skip", {
                item_id: it.id,
                kind: it.kind,
                name: (it as { name?: string }).name,
                reason: "up-to-date",
              });
            }
          } catch {
            // ignore upgrade check failures silently in apply flow
          }
        }

        finishOne(id, true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Mark unrecoverable state for validation errors or exhausted retries
        if (it.state.status !== "applied")
          it.set_status("give-up", { error: msg });
        await this.events.emit("item:apply_error", {
          item_id: it.id,
          kind: it.kind,
          name: (it as { name?: string }).name,
          error: msg,
        });
        errors.push({ id: it.id, error: msg });
        finishOne(id, false);
      }
    };

    // Simple work scheduler
    const schedule = () => {
      while (running < maxConcurrency && ready.length > 0) {
        const id = ready.shift();
        if (!id) break;
        running++;
        runItem(id).finally(() => {
          running--;
          schedule();
        });
      }
    };

    schedule();
    // Wait for completion
    await new Promise<void>((resolve) => {
      const checkDone = () => {
        if (running === 0 && ready.length === 0) resolve();
        else setTimeout(checkDone, 10);
      };
      checkDone();
    });

    // Emit skips for items that remained blocked by unapplied dependencies
    for (const id of this.deps.nodes.keys()) {
      if (processed.has(id)) continue;
      const it = this.deps.nodes.get(id);
      if (!it) continue;
      const blockers = Array.from(this.deps.incoming.get(id) ?? []).filter(
        (dep) => {
          const node = this.deps.nodes.get(dep);
          return !node || node.state.status !== "applied";
        },
      );
      await this.events.emit("item:apply_skip", {
        item_id: it.id,
        kind: it.kind,
        name: (it as { name?: string }).name,
        reason: "blocked: dependency not applied",
        blocked_by: blockers,
      });
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

  // Dedicated upgrade flow: for items already applied, check if an upgrade is
  // available and invoke the item's upgrade() if so.
  async upgrade(): Promise<void> {
    await this.events.emit("manager:upgrade_start");
    // Ensure current statuses are known
    // Probe items inline to establish current status before upgrades
    const items = this.topo_items();
    const errors: Array<{ id: string; error: string }> = [];
    let upgraded = 0;
    let skipped = 0;
    for (const it of items) {
      await this.events.emit("item:upgrade_start", {
        item_id: it.id,
        kind: it.kind,
        name: (it as { name?: string }).name,
      });
      try {
        // Skip if incompatible with host
        const matches = (
          it as { matches?: import("./host/matching.ts").HostMatchExpr }
        ).matches;
        if (matches && !this.host.evaluateMatch(matches)) {
          await this.events.emit("item:upgrade_skip", {
            item_id: it.id,
            kind: it.kind,
            name: (it as { name?: string }).name,
            reason: "incompatible host",
          });
          skipped++;
          continue;
        }
        // Probe to determine current installation status
        try {
          await it.probe(this.host);
        } catch {
          // ignore probe errors; treat as not installed
        }
        // Only upgrade items that are already applied
        if (it.state.status !== "applied") {
          await this.events.emit("item:upgrade_skip", {
            item_id: it.id,
            kind: it.kind,
            name: (it as { name?: string }).name,
            reason: "not installed",
          });
          skipped++;
          continue;
        }
        // Respect runtime blockers: dependencies must be applied
        const blockers = (it.requires ?? []).filter((depId) => {
          const dep = this.deps.nodes.get(depId);
          return !dep || dep.state.status !== "applied";
        });
        if (blockers.length > 0) {
          await this.events.emit("item:upgrade_skip", {
            item_id: it.id,
            kind: it.kind,
            name: (it as { name?: string }).name,
            reason: "blocked: dependency not applied",
          });
          skipped++;
          continue;
        }
        // Quick check: does an upgrade exist?
        let needs = false;
        try {
          needs = await it.has_upgrade(this.host);
        } catch {
          needs = false; // conservative: if check fails, skip
        }
        if (!needs) {
          await this.events.emit("item:upgrade_skip", {
            item_id: it.id,
            kind: it.kind,
            name: (it as { name?: string }).name,
            reason: "up-to-date",
          });
          skipped++;
          continue;
        }
        // Execute upgrade with retry policy similar to apply
        let done = false;
        while (!done) {
          try {
            await it.upgrade(this.host);
            it.reset_attempts();
            // remains applied
            it.set_status("applied");
            await this.events.emit("item:upgrade_done", {
              item_id: it.id,
              kind: it.kind,
              name: (it as { name?: string }).name,
            });
            done = true;
            upgraded++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            it.increment_attempts();
            if (it.can_retry) {
              // loop and retry
            } else {
              await this.events.emit("item:upgrade_error", {
                item_id: it.id,
                kind: it.kind,
                name: (it as { name?: string }).name,
                error: msg,
              });
              // Do not change applied status; record error
              errors.push({ id: it.id, error: msg });
              break;
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await this.events.emit("item:upgrade_error", {
          item_id: it.id,
          kind: it.kind,
          name: (it as { name?: string }).name,
          error: msg,
        });
        errors.push({ id: it.id, error: msg });
      }
    }
    await this.events.emit("manager:upgrade_done", {
      items: items.length,
      upgraded,
      skipped,
      failed: errors.length,
    });
    if (errors.length > 0)
      throw new AggregateError(
        errors.map((e) => new Error(`${e.id}: ${e.error}`)),
        "Upgrade encountered errors",
      );
  }
}
