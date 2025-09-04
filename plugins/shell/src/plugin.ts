import { Plugin } from "@dot-steward/core";
import { os as hostOS } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import type { ItemStatus } from "@dot-steward/core";

export class ShellPlugin extends Plugin {
  constructor() {
    super("shell", hostOS("linux", "darwin", "win32"));
  }

  async probe(_ctx: HostContext): Promise<ItemStatus> {
    // Shell is assumed available on all supported platforms
    this.set_status("applied");
    return this.state.status;
  }
}

export function shellPlugin(): ShellPlugin {
  return new ShellPlugin();
}

