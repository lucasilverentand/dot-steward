import { Item, type ItemStatus } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import { MisePlugin } from "./plugin.ts";
import { miseCurrentMatches, miseUseGlobal, miseWhich } from "./common.ts";

export class MiseGlobalTools extends Item {
  readonly tools: Record<string, string | undefined>;
  readonly plugin?: MisePlugin;
  readonly plugin_key = "mise";
  // Expose a descriptive name so plans show tool list instead of ID
  get name(): string {
    return Object.entries(this.tools)
      .map(([n, v]) => `${n}@${v ?? "latest"}`)
      .join(", ");
  }

  constructor(
    tools: Record<string, string | undefined>,
    opts?: { plugin?: MisePlugin },
  ) {
    const plugin = opts?.plugin;
    super({ kind: "mise:global", requires: plugin ? [plugin.id] : [] });
    this.tools = tools;
    this.plugin = plugin;
  }

  get_plugin_factory(): MisePlugin {
    return new MisePlugin();
  }

  async probe(ctx: HostContext): Promise<ItemStatus> {
    // Consider applied only if all tools are present and current matches version/alias
    for (const [name, version] of Object.entries(this.tools)) {
      const has = await miseWhich(name, this.plugin?.shell, ctx);
      if (!has) {
        this.set_status("pending");
        return this.state.status;
      }
      const matches = await miseCurrentMatches(
        name,
        version,
        this.plugin?.shell,
        ctx,
      );
      if (!matches) {
        this.set_status("pending");
        return this.state.status;
      }
    }
    this.set_status("applied");
    return this.state.status;
  }

  async apply(ctx: HostContext): Promise<void> {
    for (const [name, version] of Object.entries(this.tools)) {
      await miseUseGlobal(name, version, this.plugin?.shell, ctx);
    }
  }

  async validate(_ctx: HostContext): Promise<void> {
    if (!this.tools || Object.keys(this.tools).length === 0)
      throw new Error("mise.global requires at least one tool");
  }

  async plan(
    ctx: HostContext,
  ): Promise<import("@dot-steward/core").ItemPlan | null> {
    // No host-specific matches; always compatible on supported OSes via the plugin
    const list = this.name;
    if (this._state.status === "applied")
      return { summary: `[noop] mise:global ${list} (already applied)` };
    return { summary: `mise:global ${list}` };
  }

  render(): string {
    const parts = Object.entries(this.tools).map(
      ([n, v]) => `${n}@${v ?? "latest"}`,
    );
    return `[mise:global] ${parts.join(", ")}`;
  }

  dedupe_key(): string {
    const norm = Object.entries(this.tools)
      .map(([n, v]) => `${n}@${v ?? "latest"}`)
      .sort()
      .join(",");
    return `mise:global:${norm}`;
  }
}
