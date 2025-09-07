import { type ItemStatus, Plugin } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import { ExecPlugin } from "../../exec/src/plugin.ts";
import { BREW_MATCH } from "./common.ts";
import { installHomebrewNonInteractive } from "./install.ts";
import { isHomebrewInstalled } from "./install.ts";

export class BrewPlugin extends Plugin {
  // Optional injected shell plugin (resolved by Manager)
  exec?: ExecPlugin;
  constructor() {
    // Homebrew is meaningful on macOS and Linux only
    super("brew", BREW_MATCH);
  }

  async probe(_ctx: HostContext): Promise<ItemStatus> {
    const ok = await isHomebrewInstalled();
    this.set_status(ok ? "applied" : "pending");
    return this.state.status;
  }

  async apply(ctx: HostContext): Promise<void> {
    // Ensure Homebrew is installed. If not, run the official install script
    if (!(await isHomebrewInstalled())) {
      await installHomebrewNonInteractive(ctx, this.exec);
    }
  }

  async validate(_ctx: HostContext): Promise<void> {
    // No generic validation for the top-level brew plugin
  }
}

export function brewPlugin(): BrewPlugin {
  return new BrewPlugin();
}

// Declare shell as a used plugin so the Manager can discover and inject it
// without requiring users to manually add it to profiles.
(
  BrewPlugin.prototype as unknown as {
    get_used_plugins: () => Array<{
      key: string;
      get_plugin_factory: () => Plugin;
      assign?: (p: Plugin) => void;
    }>;
  }
).get_used_plugins = function (this: BrewPlugin): Array<{
  key: string;
  get_plugin_factory: () => Plugin;
  assign?: (p: Plugin) => void;
}> {
  return [
    {
      key: "exec",
      get_plugin_factory: () => new ExecPlugin(),
      assign: (p: Plugin) => {
        this.exec = p as ExecPlugin;
      },
    },
  ];
};
