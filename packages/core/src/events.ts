// Minimal typed event bus for core
import { z } from "zod";

export type Listener<T> = (payload: T) => void | Promise<void>;

export class EventBus<E = Record<string, undefined>> {
  private listeners: Map<keyof E, Set<Listener<E[keyof E]>>> = new Map();
  private validator?: (event: keyof E, payload: unknown) => void;

  setValidator(v: (event: keyof E, payload: unknown) => void): this {
    this.validator = v;
    return this;
  }

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
    // optional dev-time validation
    this.validator?.(event, payload);
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
import { ItemStatusSchema } from "./item.ts";

export type CoreEvents = {
  // Manager lifecycle
  "manager:init_start": { config_url: string };
  "manager:init_done": { profiles: number; plugins: number };
  "manager:analyze_start": undefined;
  "manager:analyze_done": undefined;
  "manager:plan_start": undefined;
  "manager:plan_done": {
    items: number;
    to_apply: number;
    skipped: number;
    noop: number;
  };
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
  // Plan stage events
  "item:plan_decision": {
    item_id: string;
    kind: string;
    name?: string;
    action: "apply" | "skip" | "noop";
    reason?: string;
    summary?: string;
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

// Zod schemas for CoreEvents payloads (dev validation)
export const CoreEventSchemas: Record<keyof CoreEvents, z.ZodTypeAny> = {
  "manager:init_start": z.object({ config_url: z.string() }).strict(),
  "manager:init_done": z
    .object({ profiles: z.number().int(), plugins: z.number().int() })
    .strict(),
  "manager:analyze_start": z.undefined(),
  "manager:analyze_done": z.undefined(),
  "manager:plan_start": z.undefined(),
  "manager:plan_done": z
    .object({
      items: z.number().int().nonnegative(),
      to_apply: z.number().int().nonnegative(),
      skipped: z.number().int().nonnegative(),
      noop: z.number().int().nonnegative(),
    })
    .strict(),
  "manager:deps_built": z
    .object({
      items: z.number().int().nonnegative(),
      edges: z.number().int().nonnegative(),
      roots: z.array(z.string()),
      missing: z.array(z.string()),
      cycles: z.array(z.array(z.string())),
    })
    .strict(),

  "item:probe_start": z
    .object({
      item_id: z.string().uuid(),
      kind: z.string(),
      name: z.string().optional(),
    })
    .strict(),
  "item:probe_done": z
    .object({
      item_id: z.string().uuid(),
      kind: z.string(),
      name: z.string().optional(),
      status: ItemStatusSchema.optional(),
    })
    .strict(),
  "item:probe_error": z
    .object({
      item_id: z.string().uuid(),
      kind: z.string(),
      name: z.string().optional(),
      error: z.string(),
    })
    .strict(),
  "item:plan_decision": z
    .object({
      item_id: z.string().uuid(),
      kind: z.string(),
      name: z.string().optional(),
      action: z.enum(["apply", "skip", "noop"]),
      reason: z.string().optional(),
      summary: z.string().optional(),
    })
    .strict(),

  "item:apply_start": z
    .object({
      item_id: z.string().uuid(),
      kind: z.string(),
      name: z.string().optional(),
    })
    .strict(),
  "item:apply_done": z
    .object({
      item_id: z.string().uuid(),
      kind: z.string(),
      name: z.string().optional(),
    })
    .strict(),
  "item:apply_error": z
    .object({
      item_id: z.string().uuid(),
      kind: z.string(),
      name: z.string().optional(),
      error: z.string(),
    })
    .strict(),

  "item:cleanup_start": z
    .object({
      item_id: z.string().uuid(),
      kind: z.string(),
      name: z.string().optional(),
    })
    .strict(),
  "item:cleanup_done": z
    .object({
      item_id: z.string().uuid(),
      kind: z.string(),
      name: z.string().optional(),
    })
    .strict(),
  "item:cleanup_error": z
    .object({
      item_id: z.string().uuid(),
      kind: z.string(),
      name: z.string().optional(),
      error: z.string(),
    })
    .strict(),

  "item:status_change": z
    .object({
      item_id: z.string().uuid(),
      kind: z.string(),
      previous: ItemStatusSchema,
      next: ItemStatusSchema,
      error: z.string().optional(),
    })
    .strict(),
  "item:attempts_change": z
    .object({
      item_id: z.string().uuid(),
      attempts: z.number().int().nonnegative(),
    })
    .strict(),
  "item:wait_added": z
    .object({
      item_id: z.string().uuid(),
      added: z.string().uuid(),
      waiting_on: z.array(z.string().uuid()),
    })
    .strict(),
  "item:wait_removed": z
    .object({
      item_id: z.string().uuid(),
      removed: z.string().uuid(),
      waiting_on: z.array(z.string().uuid()),
    })
    .strict(),
  "item:waits_cleared": z.object({ item_id: z.string().uuid() }).strict(),
  "item:blocked": z
    .object({
      item_id: z.string().uuid(),
      waiting_on: z.array(z.string().uuid()),
    })
    .strict(),
  "item:unblocked": z.object({ item_id: z.string().uuid() }).strict(),

  "item:attached": z
    .object({
      item_id: z.string().uuid(),
      kind: z.string(),
      name: z.string().optional(),
    })
    .strict(),
};

export type CoreEventName = keyof CoreEvents;

export function validateCoreEvent(name: CoreEventName, payload: unknown): void {
  const schema = CoreEventSchemas[name];
  // undefined payload schema uses z.undefined()
  const res = schema.safeParse(payload);
  if (!res.success) {
    throw new Error(
      `Invalid payload for event ${String(name)}: ${res.error.message}`,
    );
  }
}
