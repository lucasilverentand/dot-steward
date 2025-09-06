import { Item, os as hostOS } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import type { ItemPlan, ItemStatus } from "@dot-steward/core";
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

  async has_upgrade(_ctx: HostContext): Promise<boolean> {
    // Check if this specific app is reported as outdated by mas
    const res = await masExec(["outdated"]);
    if (!res.ok) return false; // treat check failures conservatively
    const lines = (res.stdout || "")
      .split(/\r?\n/g)
      .map((s) => s.trim())
      .filter(Boolean);
    const id = `${this.appId}`;
    return lines.some((ln) => ln.startsWith(`${id} `));
  }

  async plan(ctx: HostContext): Promise<ItemPlan | null> {
    const label = this.name ? `${this.name} (${this.appId})` : this.appId;
    const matches = this.matches ? ctx.evaluateMatch(this.matches) : true;
    if (!matches) return { summary: `[skip] app-store ${label} (incompatible host)` };

    // Fast path: if known applied, just check upgrades
    try {
      // Determine installed without changing internal state during planning
      const installed = await this.isInstalled();
      if (!installed) return { summary: `app-store ${label}` };
      // If installed, see if an update is available
      let needs = false;
      try {
        needs = await this.has_upgrade(ctx);
      } catch {
        needs = false;
      }
      if (needs) return { summary: `[update] app-store ${label}` };
      return { summary: `[noop] app-store ${label} (already applied)` };
    } catch {
      // On any check failure, fall back to generic summary
      return { summary: `app-store ${label}` };
    }
  }

  async upgrade(_ctx: HostContext): Promise<void> {
    // Run targeted upgrade for this app id
    const res = await masExec(["upgrade", this.appId]);
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
      throw new Error(res.stderr || `mas upgrade failed for ${this.appId}`);
    }
  }

  async validate(_ctx: HostContext): Promise<void> {
    // Basic shape validation: numeric id string
    if (!/^\d+$/.test(this.appId)) {
      throw new Error(`invalid App Store app id: ${this.appId}`);
    }
  }

  async cleanup(_ctx: HostContext): Promise<void> {
    // Uninstall the app by id if currently installed
    try {
      if (!(await this.isInstalled())) return;
    } catch {
      // proceed with uninstall attempt
    }
    const res = await masExec(["uninstall", this.appId]);
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
      throw new Error(res.stderr || `mas uninstall failed for ${this.appId}`);
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
