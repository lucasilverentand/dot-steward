import { type ItemStatus, Plugin } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import { ExecPlugin } from "../../exec/src/plugin.ts";
import { MISE_MATCH, ensureMiseInstalled, isMiseInstalled } from "./common.ts";

export class MisePlugin extends Plugin {
  shell?: ExecPlugin;

  constructor() {
    super("mise", MISE_MATCH);
  }

  async probe(ctx: HostContext): Promise<ItemStatus> {
    const ok = await isMiseInstalled(ctx, this.shell);
    this.set_status(ok ? "applied" : "pending");
    return this.state.status;
  }

  async apply(ctx: HostContext): Promise<void> {
    await ensureMiseInstalled(ctx, this.shell);
  }
}

export function misePlugin(): MisePlugin {
  return new MisePlugin();
}

// Declare used plugins for injection and dependency edges
(
  MisePlugin.prototype as unknown as {
    get_used_plugins: () => Array<{
      key: string;
      get_plugin_factory: () => Plugin;
      assign?: (p: Plugin) => void;
    }>;
  }
).get_used_plugins = function (this: MisePlugin) {
  return [
    {
      key: "exec",
      get_plugin_factory: () => new ExecPlugin(),
      assign: (p: Plugin) => {
        this.shell = p as ExecPlugin;
      },
    },
  ];
};
