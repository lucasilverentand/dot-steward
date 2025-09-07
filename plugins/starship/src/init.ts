import { Item, os as hostOS, type ItemStatus } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import { StarshipPlugin } from "./plugin.ts";
import { shell_config } from "../../shell-config/src/index.ts";

type StarshipShell = "bash" | "zsh";

export class StarshipInit extends Item {
  readonly plugin?: StarshipPlugin;
  readonly plugin_key = "starship";
  readonly matches = hostOS("linux", "darwin");
  readonly shells: StarshipShell[];

  constructor(dep?: StarshipPlugin, opts?: { shells?: StarshipShell[] }) {
    super({ kind: "starship:init", requires: dep ? [dep.id] : [] });
    this.plugin = dep;
    this.shells =
      opts?.shells && opts.shells.length > 0
        ? Array.from(new Set(opts.shells))
        : ["bash", "zsh"];

    // Contribute init lines to shell rc via the shell-config accumulator.
    // These contributions are merged and materialized by shell_config.rc.build().
    if (this.shells.includes("bash")) {
      shell_config.rc.lines([`eval "$(starship init bash)"`], "bash");
    }
    if (this.shells.includes("zsh")) {
      shell_config.rc.lines([`eval "$(starship init zsh)"`], "zsh");
    }
  }

  get_plugin_factory(): StarshipPlugin {
    return new StarshipPlugin();
  }

  async probe(ctx: HostContext): Promise<ItemStatus> {
    // Consider "applied" when starship is available; init lines are handled
    // by the shell-config profile item built by the user.
    try {
      const ok = await this.plugin?.exec?.run(
        "starship --version",
        { shell: "bash" },
        ctx,
      );
      this.set_status(ok?.ok ? "applied" : "pending");
    } catch {
      this.set_status("pending");
    }
    return this.state.status;
  }

  async validate(_ctx: HostContext): Promise<void> {}

  async apply(_ctx: HostContext): Promise<void> {
    // No runtime action; we add rc contributions during construction so
    // the shell-config profile captures them for this run.
  }

  render(): string {
    return `[starship:init] ${this.shells.join("+")}`;
  }

  dedupe_key(): string {
    return `starship:init:${this.shells.sort().join(",")}`;
  }
}
