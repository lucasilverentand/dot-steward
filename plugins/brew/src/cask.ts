import { Item, type ItemStatus } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import { BREW_MATCH, brewExec, brewExecOk } from "./common.ts";
import { BrewPlugin } from "./plugin.ts";

export class BrewCask extends Item {
  readonly name: string;
  readonly flags: string[];
  readonly matches = BREW_MATCH;
  readonly plugin?: BrewPlugin;
  readonly plugin_key = "brew";

  constructor(
    name: string,
    opts?: { flags?: string[]; requires?: string[]; plugin?: BrewPlugin },
  ) {
    const plugin = opts?.plugin;
    const reqs = [...(plugin ? [plugin.id] : []), ...(opts?.requires ?? [])];
    super({ kind: "brew:cask", requires: reqs });
    this.name = name;
    this.flags = opts?.flags ?? [];
    this.plugin = plugin;
  }

  get_plugin_factory(): BrewPlugin {
    return new BrewPlugin();
  }

  async probe(_ctx: HostContext): Promise<ItemStatus> {
    const ok = await brewExecOk(["list", "--cask", "--versions", this.name]);
    this.set_status(ok ? "applied" : "pending");
    return this.state.status;
  }

  async apply(_ctx: HostContext): Promise<void> {
    const args = ["install", "--cask", ...this.flags, this.name];
    await brewExec(args);
  }

  render(): string {
    return `[brew:cask] ${this.name}`;
  }
}

// Instances may be constructed without a plugin; Manager will bind one.
