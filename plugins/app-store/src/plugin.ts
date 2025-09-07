import { Plugin, os as hostOS } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import type { ItemStatus } from "@dot-steward/core";
import { brewExec } from "../../brew/src/common.ts";
import { BrewPlugin } from "../../brew/src/plugin.ts";
import { masOk } from "./common.ts";

export class AppStorePlugin extends Plugin {
  // Serialize brew operations with other brew-backed items
  readonly plugin_key = "brew";
  constructor() {
    // macOS only
    super("app-store", hostOS("darwin"));
  }

  private async hasMas(): Promise<boolean> {
    return masOk(["version"]);
  }

  async probe(_ctx: HostContext): Promise<ItemStatus> {
    const ok = await this.hasMas();
    this.set_status(ok ? "applied" : "pending");
    return this.state.status;
  }

  async apply(_ctx: HostContext): Promise<void> {
    // Ensure the `mas` CLI is present; install via Homebrew if missing.
    const ok = await this.hasMas();
    if (!ok) {
      await brewExec(["install", "mas"], { useFastEnv: false });
    }
  }
}

export function appStorePlugin(): AppStorePlugin {
  return new AppStorePlugin();
}

// Declare Brew as a used plugin so Manager ensures Homebrew installation
// before attempting to install `mas`.
(
  AppStorePlugin.prototype as unknown as {
    get_used_plugins: () => Array<{
      key: string;
      get_plugin_factory: () => Plugin;
      assign?: (p: Plugin) => void;
    }>;
  }
).get_used_plugins = () => [
  {
    key: "brew",
    get_plugin_factory: () => new BrewPlugin(),
  },
];
