import { Item } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import type { ItemPlan, ItemStatus } from "@dot-steward/core";
import { type ShellKind, runShell } from "./exec.ts";
import { ShellPlugin } from "./plugin.ts";

export type { ShellKind } from "./exec.ts";

export type ShellCommandOptions = {
  shell?: ShellKind;
  cwd?: string;
  env?: Record<string, string>;
  // If true, always considered pending to run on apply, no cleanup expected
  always?: boolean;
  // Run with sudo: true forces sudo, "auto" uses HostContext (non-win) when user can sudo and is not root
  sudo?: boolean | "auto";
  sudoUser?: string;
};

export class ShellCommand extends Item {
  readonly name: string;
  readonly plugin?: ShellPlugin;
  readonly plugin_key = "shell";
  readonly matches = {
    type: "any",
    of: [{ type: "os", values: ["linux", "darwin", "win32"] }],
  } as const;

  constructor(
    name: string,
    readonly applyCmd: string,
    readonly cleanupCmd?: string,
    readonly options?: ShellCommandOptions,
    plugin?: ShellPlugin,
  ) {
    super({ kind: "shell:cmd", requires: plugin ? [plugin.id] : [] });
    this.name = name;
    this.plugin = plugin;
  }

  get_plugin_factory(): ShellPlugin {
    return new ShellPlugin();
  }

  render(): string {
    return `[shell] ${this.name}`;
  }

  async probe(_ctx: HostContext): Promise<ItemStatus> {
    // For now, we don't have a check; respect `always` toggle
    if (this.options?.always) this.set_status("pending");
    else this.set_status("pending");
    return this.state.status;
  }

  async validate(_ctx: HostContext): Promise<void> {
    if (typeof this.applyCmd !== "string" || this.applyCmd.trim().length === 0)
      throw new Error("shell: apply command must be a non-empty string");
  }

  async plan(_ctx: HostContext): Promise<ItemPlan | null> {
    const note = this.options?.always ? "always" : "run";
    return { summary: `shell ${this.name} (${note})` };
  }

  async apply(ctx: HostContext): Promise<void> {
    const cwd = this.options?.cwd ?? ctx.user.home;
    if (!cwd)
      throw new Error(
        "shell: host home directory is unknown; set options.cwd or ensure HostContext.user.home",
      );
    const shell = this.options?.shell ?? (ctx.os === "win32" ? "cmd" : "sh");
    const env = { ...ctx.env.variables, ...(this.options?.env ?? {}) };
    const sudoOpt = this.options?.sudo;
    // Prefer plugin-run to allow interactive sudo prompt-once fallback
    const res = this.plugin
      ? await this.plugin.run(
          this.applyCmd,
          { shell, cwd, env, sudo: sudoOpt, sudoUser: this.options?.sudoUser },
          ctx,
        )
      : await runShell(this.applyCmd, {
          shell,
          cwd,
          env,
          sudo:
            sudoOpt === "auto"
              ? ctx.os !== "win32" && !ctx.user.is_root && !!ctx.user.can_sudo
              : !!sudoOpt,
          sudoUser: this.options?.sudoUser,
        });
    const { ok, stderr } = res;
    if (!ok)
      throw new Error(`shell apply failed: ${stderr || "command error"}`);
  }

  async cleanup(ctx: HostContext): Promise<void> {
    if (!this.cleanupCmd) return; // optional one-way commands have no cleanup
    const cwd = this.options?.cwd ?? ctx.user.home;
    if (!cwd)
      throw new Error(
        "shell: host home directory is unknown; set options.cwd or ensure HostContext.user.home",
      );
    const shell = this.options?.shell ?? (ctx.os === "win32" ? "cmd" : "sh");
    const env = { ...ctx.env.variables, ...(this.options?.env ?? {}) };
    const sudoOpt = this.options?.sudo;
    const res = this.plugin
      ? await this.plugin.run(
          this.cleanupCmd,
          { shell, cwd, env, sudo: sudoOpt, sudoUser: this.options?.sudoUser },
          ctx,
        )
      : await runShell(this.cleanupCmd, {
          shell,
          cwd,
          env,
          sudo:
            sudoOpt === "auto"
              ? ctx.os !== "win32" && !ctx.user.is_root && !!ctx.user.can_sudo
              : !!sudoOpt,
          sudoUser: this.options?.sudoUser,
        });
    const { ok, stderr } = res;
    if (!ok)
      throw new Error(`shell cleanup failed: ${stderr || "command error"}`);
  }
}
