import { Plugin } from "@dot-steward/core";
import { os as hostOS } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import type { ItemStatus } from "@dot-steward/core";

export class ConfigPlugin extends Plugin {
  constructor() {
    // Available on all main OSes
    super("config", hostOS("linux", "darwin", "win32"));
  }

  async probe(_ctx: HostContext): Promise<ItemStatus> {
    // No external dependency to check; always usable
    this.set_status("applied");
    return this.state.status;
  }

  async apply(_ctx: HostContext): Promise<void> {
    // No-op: config plugin provides file-writing items
  }
}

export function configPlugin(): ConfigPlugin {
  return new ConfigPlugin();
}
