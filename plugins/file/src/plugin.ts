import { Plugin } from "@dot-steward/core";
import { os as hostOS } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import type { ItemStatus } from "@dot-steward/core";

export class FilePlugin extends Plugin {
  constructor() {
    // Available on all main OSes
    super("file", hostOS("linux", "darwin", "win32"));
  }

  async probe(_ctx: HostContext): Promise<ItemStatus> {
    // No external dependency to check; always usable
    this.set_status("applied");
    return this.state.status;
  }

  async apply(_ctx: HostContext): Promise<void> {
    // No-op: file plugin provides file-writing/copying items
  }
}

export function filePlugin(): FilePlugin {
  return new FilePlugin();
}

