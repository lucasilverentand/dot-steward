import { Plugin, os as hostOS, type ItemStatus } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import { ExecPlugin } from "../../exec/src/plugin.ts";

export class StarshipPlugin extends Plugin {
  exec?: ExecPlugin;

  constructor() {
    // Starship supports Linux, macOS, and Windows
    super("starship", hostOS("linux", "darwin", "win32"));
  }

  async probe(ctx: HostContext): Promise<ItemStatus> {
    const ok = await this.checkAvailable(ctx);
    this.set_status(ok ? "applied" : "pending");
    return this.state.status;
  }

  async apply(_ctx: HostContext): Promise<void> {
    // No global setup here; installation is handled via package managers
    // (e.g., brew) and shell setup is contributed via items/SDK.
  }

  private async checkAvailable(ctx: HostContext): Promise<boolean> {
    try {
      const res = await this.exec?.run("starship --version", { shell: "bash" }, ctx);
      return !!res?.ok && (res.stdout.includes("starship") || res.code === 0);
    } catch {
      return false;
    }
  }
}

export function starshipPlugin(): StarshipPlugin {
  return new StarshipPlugin();
}

// Declare exec as a used plugin so the Manager can discover and inject it
(
  StarshipPlugin.prototype as unknown as {
    get_used_plugins: () => Array<{
      key: string;
      get_plugin_factory: () => Plugin;
      assign?: (p: Plugin) => void;
    }>;
  }
).get_used_plugins = function (this: StarshipPlugin) {
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

