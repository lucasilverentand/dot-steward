import type { ActionNode } from "./plan";
import type { Diff } from "./diff";
import type { HostFacts } from "./profiles";
import type { ManagedItem } from "./items";
import type {
  PluginCapability,
  PluginManifest,
  PluginReadiness,
} from "./plugins";

// Minimal SDK for defining and typing plugins.

export interface PluginContext {
  host: HostFacts;
  env?: Record<string, string | undefined>;
  // Optional per-plugin configuration passed from profiles
  config?: unknown;
}

export type PluginReadinessCheck = (
  ctx: PluginContext,
) => Promise<PluginReadiness> | PluginReadiness;

export type PluginProbeHandler = (
  item: ManagedItem,
  ctx: PluginContext,
) => Promise<unknown> | unknown;

export type PluginDiffHandler = (
  current: unknown,
  desired: unknown,
  ctx: PluginContext,
) => Promise<Diff> | Diff;

export type PluginActionHandler = (
  node: ActionNode,
  ctx: PluginContext,
) => Promise<void> | void;

export interface PluginHandlers {
  probe?: PluginProbeHandler;
  diff?: PluginDiffHandler;
  action?: PluginActionHandler;
}

export interface Plugin {
  id: string;
  manifest: PluginManifest;
  handlers: PluginHandlers;
  readiness?: PluginReadinessCheck;
  capabilityHandlers?: Record<string, PluginHandlers>;
  supports?: (item: ManagedItem, ctx: PluginContext) => boolean;
}

class PluginBuilderImpl {
  private _manifest: PluginManifest;
  private _handlers: PluginHandlers = {};
  private _readiness?: PluginReadinessCheck;
  private _capHandlers: Record<string, PluginHandlers> = {};
  private _supports?: (item: ManagedItem, ctx: PluginContext) => boolean;

  constructor(id: string) {
    this._manifest = { id, capabilities: [] } as PluginManifest;
  }

  capability(
    id: string,
    _schema?: unknown,
    opts?: { description?: string; provides?: PluginCapability["provides"] },
  ): this {
    const cap: PluginCapability = {
      id,
      provides: (opts?.provides ?? []) as PluginCapability["provides"],
      description: opts?.description,
    };
    this._manifest.capabilities.push(cap);
    return this;
  }

  // Global handlers for simplicity; can be refined per capability later
  probe(fn: PluginProbeHandler): this {
    this._handlers.probe = fn;
    return this;
  }

  diff(fn: PluginDiffHandler): this {
    this._handlers.diff = fn;
    return this;
  }

  action(fn: PluginActionHandler): this {
    this._handlers.action = fn;
    return this;
  }

  ready(fn: PluginReadinessCheck): this {
    this._readiness = fn;
    return this;
  }

  on(capabilityId: string, handlers: PluginHandlers): this {
    this._capHandlers[capabilityId] = {
      ...(this._capHandlers[capabilityId] ?? {}),
      ...handlers,
    };
    return this;
  }

  supports(fn: (item: ManagedItem, ctx: PluginContext) => boolean): this {
    this._supports = fn;
    return this;
  }

  build(): Plugin {
    return {
      id: this._manifest.id,
      manifest: this._manifest,
      handlers: this._handlers,
      readiness: this._readiness,
      capabilityHandlers: this._capHandlers,
      supports: this._supports,
    };
  }
}

export const Plugin = {
  define(id: string) {
    return new PluginBuilderImpl(id);
  },
};
