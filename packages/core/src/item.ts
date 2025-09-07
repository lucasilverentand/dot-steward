import { z } from "zod";
import type { CoreEvents } from "./events.ts";
import type { EventBus } from "./events.ts";
import type { HostContext } from "./host/context.ts";

export const ItemStatusSchema = z.enum([
  "applied", // done
  "pending", // waiting for external factors
  "failed", // failed, but can retry
  "give-up", // retries failed
  "unprobed", // needs to be probed
]);

export type ItemStatus = z.infer<typeof ItemStatusSchema>;

export const ItemStateSchema = z.object({
  status: ItemStatusSchema,
  waiting_on: z.array(z.string().uuid()).default([]),
  attempts: z.number().int().nonnegative().default(0),
  last_error: z.string().optional(),
});

export type ItemState = z.infer<typeof ItemStateSchema>;

export const ItemSchema = z.object({
  id: z.string().uuid(),
  kind: z.string().min(1),
  state: ItemStateSchema,
  requires: z.array(z.string().uuid()).default([]),
});

export type ItemShape = z.infer<typeof ItemSchema>;

export type ItemPlan = {
  summary: string;
  changes?: string[];
};

export abstract class Item implements ItemShape {
  readonly id: string;
  readonly kind: string;
  readonly requires: string[];
  protected _state: ItemState;
  /** Max retry attempts considered by can_retry() */
  protected max_attempts = 3;
  protected _events?: EventBus<CoreEvents>;

  constructor(params: {
    id?: string;
    kind: string;
    state?: Partial<ItemState>;
    requires?: string[];
  }) {
    this.id = params.id ?? Item.new_id();
    this.kind = params.kind;
    this.requires = params.requires ?? [];
    const baseState = ItemStateSchema.parse({
      status: params.state?.status ?? "unprobed",
      waiting_on: params.state?.waiting_on ?? [],
      attempts: params.state?.attempts ?? 0,
      last_error: params.state?.last_error,
    });
    this._state = baseState;
  }

  get state(): ItemState {
    return this._state;
  }

  attach_events(bus: EventBus<CoreEvents>): this {
    this._events = bus;
    // emit registration event
    const n = ((): string | undefined => {
      const rec = this as Record<string, unknown>;
      const v = (rec as { name?: unknown }).name;
      return typeof v === "string" ? v : undefined;
    })();
    this._events.emit("item:attached", {
      item_id: this.id,
      kind: this.kind,
      name: n,
    });
    return this;
  }

  // Lifecycle
  abstract probe(ctx: HostContext): Promise<ItemStatus>;
  // Validate configuration/preconditions. Throw on invalid state.
  abstract validate(ctx: HostContext): Promise<void>;
  abstract apply(ctx: HostContext): Promise<void>;
  cleanup(_ctx: HostContext): Promise<void> {
    return Promise.resolve();
  }

  // Upgrade flow (optional): subclasses can override to support upgrades.
  // Default: no upgrades available / no-op.
  async has_upgrade(_ctx: HostContext): Promise<boolean> {
    return false;
  }

  async upgrade(_ctx: HostContext): Promise<void> {
    // By default, items do not support upgrades; treat as no-op.
    return Promise.resolve();
  }

  // Planning: default implementation returns a generic summary.
  // Subclasses may override to provide detailed changes.
  async plan(ctx: HostContext): Promise<ItemPlan | null> {
    const matches = (
      this as {
        matches?: import("./host/matching.ts").HostMatchExpr;
      }
    ).matches;
    const compatible = matches ? ctx.evaluateMatch(matches) : true;
    const name = (this as { name?: string }).name ?? this.id.slice(0, 8);
    if (!compatible)
      return { summary: `[skip] ${this.kind} ${name} (incompatible host)` };
    if (this._state.status === "applied")
      return { summary: `[noop] ${this.kind} ${name} (already applied)` };
    // For planned application, omit the "[apply]" prefix; the CLI plan
    // view renders a leading symbol instead.
    return { summary: `${this.kind} ${name}` };
  }

  // State helpers
  protected setState(patch: Partial<ItemState>): this {
    const next = {
      ...this._state,
      ...patch,
    };
    this._state = ItemStateSchema.parse(next);
    return this;
  }

  set_status(status: ItemStatus, opts?: { error?: string }): this {
    const prev = this._state.status;
    this.setState({ status, last_error: opts?.error });
    // Emit event for listeners
    this._events?.emit("item:status_change", {
      item_id: this.id,
      kind: this.kind,
      previous: prev,
      next: status,
      error: opts?.error,
    });
    this.on_status_change(prev, status);
    return this;
  }

  protected on_status_change(_prev: ItemStatus, _next: ItemStatus): void {
    // override in subclasses for logging/metrics
  }

  increment_attempts(): this {
    const attempts = (this._state.attempts ?? 0) + 1;
    this.setState({ attempts });
    this._events?.emit("item:attempts_change", {
      item_id: this.id,
      attempts,
    });
    return this;
  }

  reset_attempts(): this {
    return this.setState({ attempts: 0 });
  }

  add_wait(id: string): this {
    if (!this._state.waiting_on.includes(id)) {
      const was_empty = this._state.waiting_on.length === 0;
      const waiting_on = [...this._state.waiting_on, id];
      this.setState({ waiting_on });
      this._events?.emit("item:wait_added", {
        item_id: this.id,
        added: id,
        waiting_on,
      });
      if (was_empty && waiting_on.length > 0) {
        this._events?.emit("item:blocked", { item_id: this.id, waiting_on });
      }
    }
    return this;
  }

  remove_wait(id: string): this {
    if (this._state.waiting_on.includes(id)) {
      const waiting_on = this._state.waiting_on.filter((x) => x !== id);
      this.setState({ waiting_on });
      this._events?.emit("item:wait_removed", {
        item_id: this.id,
        removed: id,
        waiting_on,
      });
      if (waiting_on.length === 0) {
        this._events?.emit("item:unblocked", { item_id: this.id });
      }
    }
    return this;
  }

  clear_waits(): this {
    this.setState({ waiting_on: [] });
    this._events?.emit("item:waits_cleared", { item_id: this.id });
    this._events?.emit("item:unblocked", { item_id: this.id });
    return this;
  }

  get is_terminal(): boolean {
    return this._state.status === "applied" || this._state.status === "give-up";
  }

  get is_blocked(): boolean {
    return this._state.waiting_on.length > 0;
  }

  get can_retry(): boolean {
    return (
      this._state.status === "failed" &&
      (this._state.attempts ?? 0) < this.max_attempts
    );
  }

  equals(other: Item): boolean {
    return this.id === other.id;
  }

  // Render a very simple single-line: [kind] name
  render(): string {
    const name = (this as { name?: string }).name ?? this.id.slice(0, 8);
    return `[${this.kind}] ${name}`;
  }

  toJSON(): ItemShape {
    return {
      id: this.id,
      kind: this.kind,
      state: this._state,
      requires: this.requires,
    };
  }

  // Convenience snake_case alias if desired by callers
  get json(): ItemShape {
    return this.toJSON();
  }

  static parse(data: unknown): ItemShape {
    return ItemSchema.parse(data);
  }

  private static new_id(): string {
    try {
      const id = (
        globalThis as unknown as { crypto?: { randomUUID?: () => string } }
      ).crypto?.randomUUID?.();
      if (typeof id === "string" && id.length > 0) return id;
    } catch {
      // Fallback for environments without crypto.randomUUID
      const rnd = Math.random().toString(16).slice(2).padEnd(12, "0");
      return `00000000-0000-4000-8000-${rnd.slice(0, 12)}`;
    }
    // Final fallback if crypto.randomUUID exists but failed unexpectedly
    const rnd = Math.random().toString(16).slice(2).padEnd(12, "0");
    return `00000000-0000-4000-8000-${rnd.slice(0, 12)}`;
  }
}
