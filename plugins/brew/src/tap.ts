import { Item, type ItemStatus } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import { BREW_MATCH, brewExec, execCapture, findBrewCmd } from "./common.ts";
import { BrewFormula } from "./formula.ts";
import { BrewPlugin } from "./plugin.ts";

export class BrewTap extends Item {
  readonly tap: string;
  readonly matches = BREW_MATCH;
  readonly plugin?: BrewPlugin;
  readonly plugin_key = "brew";

  constructor(
    tap: string,
    opts?: { requires?: string[]; plugin?: BrewPlugin },
  ) {
    const plugin = opts?.plugin;
    const reqs = [...(plugin ? [plugin.id] : []), ...(opts?.requires ?? [])];
    super({ kind: "brew:tap", requires: reqs });
    this.tap = tap;
    this.plugin = plugin;
  }

  get_plugin_factory(): BrewPlugin {
    return new BrewPlugin();
  }

  async probe(_ctx: HostContext): Promise<ItemStatus> {
    const cmd = await findBrewCmd();
    if (!cmd) {
      this.set_status("pending");
      return this.state.status;
    }
    const { ok, stdout } = await execCapture(cmd, ["tap"]);
    const installed =
      ok &&
      stdout
        .split(/\r?\n/g)
        .map((s) => s.trim())
        .filter(Boolean)
        .includes(this.tap);
    this.set_status(installed ? "applied" : "pending");
    return this.state.status;
  }

  async apply(_ctx: HostContext): Promise<void> {
    await brewExec(["tap", this.tap], { timeoutMs: 5 * 60_000 });
  }

  async validate(_ctx: HostContext): Promise<void> {
    // Validate the tap identifier shape (owner/repo). Existence is handled by apply().
    if (!/^[^/]+\/[^/]+$/.test(this.tap)) {
      throw new Error(`invalid brew tap name: ${this.tap}`);
    }
  }

  render(): string {
    return `[brew:tap] ${this.tap}`;
  }

  // Convenience creators that ensure dependency ordering and namespacing
  formula(name: string) {
    const fq = name.includes("/") ? name : `${this.tap}/${name}`;
    return new BrewFormula(fq, { plugin: this.plugin, tap: this });
  }

  cask(name: string, opts?: { flags?: string[] }) {
    const fq = name.includes("/") ? name : `${this.tap}/${name}`;
    return new BrewFormula(fq, {
      plugin: this.plugin,
      tap: this,
      kind: "cask",
      flags: opts?.flags,
    });
  }
}

// Instances may be constructed without a plugin; Manager will bind one.
