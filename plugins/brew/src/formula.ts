import { Item, type ItemStatus } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import {
  BREW_MATCH,
  brewExec,
  brewExecOk,
  brewInfoOk,
  brewOutdated,
  findBrewCmd,
} from "./common.ts";
import { BrewPlugin } from "./plugin.ts";
import type { BrewTap } from "./tap.ts";

export class BrewFormula extends Item {
  readonly name: string;
  readonly matches = BREW_MATCH;
  readonly plugin?: BrewPlugin;
  readonly plugin_key = "brew";
  readonly tap?: BrewTap;
  readonly pkgKind: "formula" | "cask";
  readonly flags: string[];

  constructor(
    name: string,
    opts?: {
      plugin?: BrewPlugin;
      tap?: BrewTap;
      kind?: "formula" | "cask";
      flags?: string[];
    },
  ) {
    const plugin = opts?.plugin;
    const reqs = [
      ...(plugin ? [plugin.id] : []),
      ...(opts?.tap ? [opts.tap.id] : []),
    ];
    const kind = opts?.kind ?? "formula";
    super({
      kind: kind === "cask" ? "brew:cask" : "brew:formula",
      requires: reqs,
    });
    this.name = name;
    this.plugin = plugin;
    this.tap = opts?.tap;
    this.pkgKind = kind;
    this.flags = opts?.flags ?? [];
  }

  get_plugin_factory(): BrewPlugin {
    return new BrewPlugin();
  }

  async probe(_ctx: HostContext): Promise<ItemStatus> {
    // Consider installed if brew reports a version for the formula/cask
    const kindFlag = this.pkgKind === "cask" ? "--cask" : "--formula";
    const ok = await brewExecOk(["list", kindFlag, "--versions", this.name]);
    this.set_status(ok ? "applied" : "pending");
    return this.state.status;
  }

  async apply(_ctx: HostContext): Promise<void> {
    if (this.pkgKind === "cask") {
      await brewExec(["install", "--cask", ...this.flags, this.name]);
    } else {
      await brewExec(["install", this.name]);
    }
  }

  async has_upgrade(_ctx: HostContext): Promise<boolean> {
    return brewOutdated(this.pkgKind, this.name);
  }

  async upgrade(_ctx: HostContext): Promise<void> {
    if (this.pkgKind === "cask") {
      await brewExec(["upgrade", "--cask", ...this.flags, this.name], {
        useFastEnv: false, // allow brew to auto-update metadata for upgrades
      });
    } else {
      await brewExec(["upgrade", this.name], { useFastEnv: false });
    }
  }

  async cleanup(_ctx: HostContext): Promise<void> {
    // Attempt uninstall; ignore when not installed
    if (this.pkgKind === "cask") {
      await brewExec(["uninstall", "--cask", ...this.flags, this.name], {
        useFastEnv: false,
      });
    } else {
      await brewExec(["uninstall", this.name], { useFastEnv: false });
    }
  }

  async validate(_ctx: HostContext): Promise<void> {
    // For casks, tapping is no longer required; if a tap is provided, ensure it matches a qualified name
    if (this.pkgKind === "cask") {
      if (this.name.includes("/")) {
        const parts = this.name.split("/");
        if (parts.length >= 3) {
          const tapName = `${parts[0]}/${parts[1]}`;
          if (this.tap && this.tap.tap !== tapName) {
            throw new Error(
              `brew cask '${this.name}' tap mismatch: expected '${tapName}', got '${this.tap.tap}'`,
            );
          }
        }
      }
    } else {
      // For formulas, if the name is tap-qualified, ensure matching tap when provided
      if (this.name.includes("/")) {
        const parts = this.name.split("/");
        if (parts.length >= 3) {
          const tapName = `${parts[0]}/${parts[1]}`;
          if (!this.tap) {
            throw new Error(
              `brew formula '${this.name}' requires an explicit tap('${tapName}') item. Pass it via { tap }.`,
            );
          }
          if (this.tap.tap !== tapName) {
            throw new Error(
              `brew formula '${this.name}' tap mismatch: expected '${tapName}', got '${this.tap.tap}'`,
            );
          }
        }
      }
    }

    // If brew is available, ensure the package exists before planning/applying.
    // Skip existence check when brew is not installed yet (apply will ensure it).
    const brewCmd = await findBrewCmd();
    if (brewCmd) {
      const okCmd = await brewInfoOk(this.pkgKind, this.name);
      if (!okCmd)
        throw new Error(`brew ${this.pkgKind} not found: ${this.name}`);
    }
  }

  render(): string {
    return `[brew:${this.pkgKind}] ${this.name}`;
  }

  // Allow Manager to deduplicate identical formula/cask items across profiles.
  // Include flags for casks to avoid merging items with different behaviors.
  dedupe_key(): string {
    const base = `brew:${this.pkgKind}:${this.name}`;
    if (this.pkgKind === "cask" && this.flags && this.flags.length > 0) {
      const flagsNorm = Array.from(new Set(this.flags)).sort().join(",");
      return `${base}|flags=${flagsNorm}`;
    }
    return base;
  }
}

// Instances may be constructed without a plugin; Manager will bind one.
