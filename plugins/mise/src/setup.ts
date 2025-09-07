import { Item, type ItemStatus } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import { MisePlugin } from "./plugin.ts";
import { ensureMiseInstalled, isMiseInstalled } from "./common.ts";

export class MiseSetup extends Item {
  readonly plugin?: MisePlugin;
  readonly plugin_key = "mise";

  constructor(opts?: { plugin?: MisePlugin }) {
    const plugin = opts?.plugin;
    super({ kind: "mise:setup", requires: plugin ? [plugin.id] : [] });
    this.plugin = plugin;
  }

  get_plugin_factory(): MisePlugin {
    return new MisePlugin();
  }

  async probe(ctx: HostContext): Promise<ItemStatus> {
    const ok = await isMiseInstalled(ctx, this.plugin?.shell);
    this.set_status(ok ? "applied" : "pending");
    return this.state.status;
  }

  async apply(ctx: HostContext): Promise<void> {
    await ensureMiseInstalled(ctx, this.plugin?.shell);
  }

  async validate(_ctx: HostContext): Promise<void> {
    // no specific validation
  }

  async plan(ctx: HostContext): Promise<import("@dot-steward/core").ItemPlan | null> {
    if (this._state.status === "applied")
      return { summary: `[noop] mise:setup (already applied)` };
    return { summary: `mise:setup` };
  }

  render(): string {
    return `[mise:setup]`;
  }
}
