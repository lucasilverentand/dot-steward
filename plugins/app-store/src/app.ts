import { Item, os as hostOS } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import type { ItemStatus } from "@dot-steward/core";
import { AppStorePlugin } from "./plugin.ts";
import { masExec } from "./common.ts";

export class AppStoreApp extends Item {
  readonly appId: string;
  readonly name?: string;
  readonly matches = hostOS("darwin");
  readonly plugin?: AppStorePlugin;
  readonly plugin_key = "app-store";

  constructor(
    appId: number | string,
    opts?: { name?: string; plugin?: AppStorePlugin; dep?: { id: string } },
  ) {
    const plugin = opts?.plugin;
    const requires = [
      ...(plugin ? [plugin.id] : []),
      ...(opts?.dep ? [opts.dep.id] : []),
    ];
    super({ kind: "app-store:app", requires });
    this.appId = String(appId);
    this.name = opts?.name;
    this.plugin = plugin;
  }

  get_plugin_factory(): AppStorePlugin {
    return new AppStorePlugin();
  }

  private async isInstalled(): Promise<boolean> {
    const out = await masExec(["list"]);
    if (!out.ok) return false;
    const lines = out.stdout
      .split(/\r?\n/g)
      .map((s) => s.trim())
      .filter(Boolean);
    return lines.some((ln) => ln.startsWith(`${this.appId} `));
  }

  private async isSignedIn(): Promise<boolean> {
    const res = await masExec(["account"]);
    if (!res.ok) return false;
    const out = (res.stdout || res.stderr || "").toLowerCase();
    if (out.includes("not signed in")) return false;
    return (res.stdout || "").trim().length > 0;
  }

  async probe(_ctx: HostContext): Promise<ItemStatus> {
    const ok = await this.isInstalled();
    this.set_status(ok ? "applied" : "pending");
    return this.state.status;
  }

  async apply(_ctx: HostContext): Promise<void> {
    // No shell plugin required; call mas directly
    // If already installed, no-op
    if (await this.isInstalled()) return;

    // Try install; if it fails due to not purchased, attempt purchase then retry
    const tryInstall = async () => masExec(["install", this.appId]);

    let res = await tryInstall();
    if (!res.ok) {
      const out = (res.stdout + "\n" + res.stderr).toLowerCase();
      const notSigned =
        out.includes("not signed in") ||
        out.includes("please sign in") ||
        out.includes("sign in to") ||
        out.includes("sign in");
      if (notSigned) {
        throw new Error(
          "Not signed into the Mac App Store. Open the App Store app and sign in first.",
        );
      }
      const notPurchased =
        out.includes("not purchased") || out.includes("has not been purchased");
      if (notPurchased) {
        const p = await masExec(["purchase", this.appId]);
        if (!p.ok) {
          throw new Error(
            p.stderr || `Unable to purchase app ${this.appId}. Purchase in App Store then retry.`,
          );
        }
        res = await tryInstall();
      }
    }
    if (!res.ok) {
      throw new Error(res.stderr || `mas install failed for ${this.appId}`);
    }
  }

  async validate(_ctx: HostContext): Promise<void> {
    // Basic shape validation: numeric id string
    if (!/^\d+$/.test(this.appId)) {
      throw new Error(`invalid App Store app id: ${this.appId}`);
    }
  }

  render(): string {
    const label = this.name ? `${this.name} (${this.appId})` : this.appId;
    return `[app-store] ${label}`;
  }

  // Allow Manager to deduplicate identical app items across profiles
  dedupe_key(): string {
    return `app-store:${this.appId}`;
  }
}
