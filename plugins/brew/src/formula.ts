import { Item, type ItemStatus } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import { BREW_MATCH, brewExec, brewExecOk } from "./common.ts";
import { BrewPlugin } from "./plugin.ts";

export class BrewFormula extends Item {
  readonly name: string;
  readonly matches = BREW_MATCH;
  readonly plugin?: BrewPlugin;
  readonly plugin_key = "brew";

  constructor(name: string, opts?: { requires?: string[]; plugin?: BrewPlugin }) {
    const plugin = opts?.plugin;
    const reqs = [
      ...(plugin ? [plugin.id] : []),
      ...(opts?.requires ?? []),
    ];
    super({ kind: "brew:formula", requires: reqs });
    this.name = name;
    this.plugin = plugin;
  }

  get_plugin_factory(): BrewPlugin {
    return new BrewPlugin();
  }

  async probe(_ctx: HostContext): Promise<ItemStatus> {
    // Consider installed if brew reports a version for the formula
    const ok = await brewExecOk(["list", "--formula", "--versions", this.name]);
    this.set_status(ok ? "applied" : "pending");
    return this.state.status;
  }

  async apply(_ctx: HostContext): Promise<void> {
    await brewExec(["install", this.name]);
  }

  render(): string {
    return `[brew:formula] ${this.name}`;
  }
}

// Instances may be constructed without a plugin; Manager will bind one.
