import { type ItemStatus, Plugin, os as hostOS } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import { ExecPlugin } from "../../exec/src/plugin.ts";

export class GhosttyPlugin extends Plugin {
  exec?: ExecPlugin;

  constructor() {
    // Ghostty supports Linux and macOS
    super("ghostty", hostOS("linux", "darwin"));
  }

  async probe(ctx: HostContext): Promise<ItemStatus> {
    const ok = await this.checkAvailable(ctx);
    this.set_status(ok ? "applied" : "pending");
    return this.state.status;
  }

  async apply(_ctx: HostContext): Promise<void> {
    // No global setup; installation handled by install item
  }

  private async checkAvailable(ctx: HostContext): Promise<boolean> {
    try {
      const res = await this.exec?.run(
        "ghostty --version",
        { shell: "bash" },
        ctx,
      );
      return !!res?.ok && (res.stdout.includes("ghostty") || res.code === 0);
    } catch {
      return false;
    }
  }
}

export function ghosttyPlugin(): GhosttyPlugin {
  return new GhosttyPlugin();
}

// Declare exec as a used plugin so the Manager can discover and inject it
(
  GhosttyPlugin.prototype as unknown as {
    get_used_plugins: () => Array<{
      key: string;
      get_plugin_factory: () => Plugin;
      assign?: (p: Plugin) => void;
    }>;
  }
).get_used_plugins = function (this: GhosttyPlugin) {
  return [
    {
      key: "exec",
      get_plugin_factory: () => new ExecPlugin(),
      assign: (p) => {
        this.exec = p as ExecPlugin;
      },
    },
  ];
};
