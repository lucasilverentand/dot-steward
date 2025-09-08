import { Item, type ItemStatus, os as hostOS } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import { GhosttyPlugin } from "./plugin.ts";

export class GhosttyInstall extends Item {
  readonly plugin?: GhosttyPlugin;
  readonly plugin_key = "ghostty";
  readonly matches = hostOS("linux", "darwin");

  constructor(dep?: GhosttyPlugin) {
    super({ kind: "ghostty:install", requires: dep ? [dep.id] : [] });
    this.plugin = dep;
  }

  get_plugin_factory(): GhosttyPlugin {
    return new GhosttyPlugin();
  }

  async probe(ctx: HostContext): Promise<ItemStatus> {
    try {
      const res = await this.plugin?.exec?.run(
        "ghostty --version",
        { shell: "bash" },
        ctx,
      );
      this.set_status(res?.ok ? "applied" : "pending");
    } catch {
      this.set_status("pending");
    }
    return this.state.status;
  }

  async validate(_ctx: HostContext): Promise<void> {}

  async apply(ctx: HostContext): Promise<void> {
    await this.plugin?.exec?.run(
      // Homebrew cask supports macOS; Linux may use formula if available
      "brew install --cask ghostty || brew install ghostty",
      { shell: "bash" },
      ctx,
    );
  }

  render(): string {
    return "[ghostty:install]";
  }

  dedupe_key(): string {
    return "ghostty:install";
  }
}
