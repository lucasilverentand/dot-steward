import { type ItemStatus, Plugin } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import { BREW_MATCH } from "./common.ts";
import { installHomebrewNonInteractive } from "./install.ts";
import { isHomebrewInstalled } from "./install.ts";

export class BrewPlugin extends Plugin {
  constructor() {
    // Homebrew is meaningful on macOS and Linux only
    super("brew", BREW_MATCH);
  }

  async probe(_ctx: HostContext): Promise<ItemStatus> {
    const ok = await isHomebrewInstalled();
    this.set_status(ok ? "applied" : "pending");
    return this.state.status;
  }

  async apply(_ctx: HostContext): Promise<void> {
    // Ensure Homebrew is installed. If not, run the official install script
    if (!(await isHomebrewInstalled())) {
      await installHomebrewNonInteractive();
    }
  }

  async validate(_ctx: HostContext): Promise<void> {
    // No generic validation for the top-level brew plugin
  }
}

export function brewPlugin(): BrewPlugin {
  return new BrewPlugin();
}
