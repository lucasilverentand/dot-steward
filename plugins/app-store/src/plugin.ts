import { Plugin, os as hostOS } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import type { ItemStatus } from "@dot-steward/core";
import { masOk } from "./common.ts";

export class AppStorePlugin extends Plugin {

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
    // No-op: installation of `mas` is handled via a Brew formula dependency
    // added by the SDK (appStore.app() returns [brew.formula("mas"), app]).
    // This keeps all brew operations serialized under the Brew plugin.
  }
}

export function appStorePlugin(): AppStorePlugin {
  return new AppStorePlugin();
}
