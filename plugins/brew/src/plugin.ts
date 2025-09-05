import { type ItemStatus, Plugin } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import { BREW_MATCH } from "./common.ts";
import { installHomebrewNonInteractive } from "./install.ts";
import { isHomebrewInstalled } from "./install.ts";
import { ShellPlugin } from "@dot-steward/plugin-shell";

export class BrewPlugin extends Plugin {
  // Optional injected shell plugin (resolved by Manager)
  shell?: ShellPlugin;
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
      await installHomebrewNonInteractive(ctx, this.shell);
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
(BrewPlugin.prototype as any).get_used_plugins = function (): Array<{
  key: string;
  get_plugin_factory: () => Plugin;
  assign?: (p: Plugin) => void;
}> {
  return [
    {
      key: "shell",
      get_plugin_factory: () => new ShellPlugin(),
      assign: (p: Plugin) => {
        (this as BrewPlugin).shell = p as ShellPlugin;
      },
    },
  ];
};
