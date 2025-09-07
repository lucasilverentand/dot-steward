import { Item, type ItemStatus } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import { MisePlugin } from "./plugin.ts";
import { miseCurrentMatches, miseUseGlobal, miseWhich } from "./common.ts";

export class MiseTool extends Item {
  readonly name: string;
  readonly version?: string;
  readonly plugin?: MisePlugin;
  readonly plugin_key = "mise";

  constructor(name: string, version?: string, opts?: { plugin?: MisePlugin }) {
    const plugin = opts?.plugin;
    super({ kind: "mise:tool", requires: plugin ? [plugin.id] : [] });
    this.name = name;
    this.version = version;
    this.plugin = plugin;
  }

  get_plugin_factory(): MisePlugin {
    return new MisePlugin();
  }

  async probe(ctx: HostContext): Promise<ItemStatus> {
    const hasTool = await miseWhich(this.name, this.plugin?.shell, ctx);
    if (!hasTool) {
      this.set_status("pending");
      return this.state.status;
    }
    const matches = await miseCurrentMatches(
      this.name,
      this.version,
      this.plugin?.shell,
      ctx,
    );
    this.set_status(matches ? "applied" : "pending");
    return this.state.status;
  }

  async apply(ctx: HostContext): Promise<void> {
    await miseUseGlobal(this.name, this.version, this.plugin?.shell, ctx);
  }

  async validate(_ctx: HostContext): Promise<void> {
    if (!this.name || this.name.trim().length === 0)
      throw new Error("mise.tool requires a non-empty tool name");
  }

  async plan(
    ctx: HostContext,
  ): Promise<import("@dot-steward/core").ItemPlan | null> {
    const v = this.version ?? "latest";
    if (this._state.status === "applied")
      return {
        summary: `[noop] mise:tool ${this.name}@${v} (already applied)`,
      };
    return { summary: `mise:tool ${this.name}@${v}` };
  }

  render(): string {
    const v = this.version ?? "latest";
    return `[mise] ${this.name}@${v}`;
  }

  dedupe_key(): string {
    return `mise:tool:${this.name}@${this.version ?? "latest"}`;
  }
}
