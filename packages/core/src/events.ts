// Minimal typed event bus for core

export type Listener<T> = (payload: T) => void | Promise<void>;

export class EventBus<E = Record<string, undefined>> {
  private listeners: Map<keyof E, Set<Listener<E[keyof E]>>> = new Map();

  on<K extends keyof E>(event: K, listener: Listener<E[K]>): () => void {
    const existing = this.listeners.get(event) as
      | Set<Listener<E[K]>>
      | undefined;
    const set: Set<Listener<E[K]>> = existing ?? new Set<Listener<E[K]>>();
    set.add(listener);
    this.listeners.set(event, set as Set<Listener<E[keyof E]>>);
    return () => this.off(event, listener);
  }

  once<K extends keyof E>(event: K, listener: Listener<E[K]>): () => void {
    const wrap: Listener<E[K]> = async (payload) => {
      this.off(event, wrap);
      await listener(payload);
    };
    return this.on(event, wrap);
  }

  off<K extends keyof E>(event: K, listener: Listener<E[K]>): void {
    const set = this.listeners.get(event) as Set<Listener<E[K]>> | undefined;
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) this.listeners.delete(event);
  }

  async emit<K extends keyof E>(event: K, payload: E[K]): Promise<void>;
  async emit<K extends keyof E>(event: K): Promise<void>;
  async emit<K extends keyof E>(event: K, payload?: E[K]): Promise<void> {
    const set = this.listeners.get(event) as Set<Listener<E[K]>> | undefined;
    if (!set || set.size === 0) return;
    // Run listeners sequentially to keep order deterministic
    for (const l of Array.from(set)) {
      await l(payload as E[K]);
    }
  }
}

// Core-wide event contracts
import type { ItemStatus } from "./item.ts";

export type CoreEvents = {
  // Manager lifecycle
  "manager:init_start": { config_url: string };
  "manager:init_done": { profiles: number; plugins: number };
  "manager:analyze_start": undefined;
  "manager:analyze_done": undefined;
  "manager:deps_built": {
    items: number;
    edges: number;
    roots: string[];
    missing: string[];
    cycles: string[][];
  };

  // Item lifecycle (plugins are items)
  "item:probe_start": { item_id: string; kind: string; name?: string };
  "item:probe_done": {
    item_id: string;
    kind: string;
    name?: string;
    status?: ItemStatus;
  };
  "item:probe_error": {
    item_id: string;
    kind: string;
    name?: string;
    error: string;
  };

  // Application lifecycle
  "item:apply_start": { item_id: string; kind: string; name?: string };
  "item:apply_done": { item_id: string; kind: string; name?: string };
  "item:apply_error": {
    item_id: string;
    kind: string;
    name?: string;
    error: string;
  };

  // Cleanup lifecycle
  "item:cleanup_start": { item_id: string; kind: string; name?: string };
  "item:cleanup_done": { item_id: string; kind: string; name?: string };
  "item:cleanup_error": {
    item_id: string;
    kind: string;
    name?: string;
    error: string;
  };

  // Item state changes
  "item:status_change": {
    item_id: string;
    kind: string;
    previous: ItemStatus;
    next: ItemStatus;
    error?: string;
  };
  "item:attempts_change": { item_id: string; attempts: number };
  "item:wait_added": {
    item_id: string;
    added: string;
    waiting_on: string[];
  };
  "item:wait_removed": {
    item_id: string;
    removed: string;
    waiting_on: string[];
  };
  "item:waits_cleared": { item_id: string };
  "item:blocked": { item_id: string; waiting_on: string[] };
  "item:unblocked": { item_id: string };

  // Registration
  "item:attached": { item_id: string; kind: string; name?: string };
};
