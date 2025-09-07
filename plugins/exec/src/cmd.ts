import { Item } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import type { ItemPlan, ItemStatus } from "@dot-steward/core";
import { type ShellKind, runShell } from "./exec.ts";
import { ExecPlugin } from "./plugin.ts";

export type ExecCommandOptions = {
  shell?: ShellKind;
  cwd?: string;
  env?: Record<string, string>;
  always?: boolean;
  sudo?: boolean | "auto";
  sudoUser?: string;
};

export class ExecCommand extends Item {
  readonly name: string;
  readonly plugin?: ExecPlugin;
  readonly plugin_key = "exec";
  readonly matches = { type: "any", of: [{ type: "os", values: ["linux", "darwin", "win32"] }] } as const;

  constructor(name: string, readonly applyCmd: string, readonly cleanupCmd?: string, readonly options?: ExecCommandOptions, plugin?: ExecPlugin) {
    super({ kind: "exec:cmd", requires: plugin ? [plugin.id] : [] });
    this.name = name;
    this.plugin = plugin;
  }

  get_plugin_factory(): ExecPlugin {
    return new ExecPlugin();
  }

  render(): string { return `[exec] ${this.name}`; }

  async probe(_ctx: HostContext): Promise<ItemStatus> {
    if (this.options?.always) this.set_status("pending");
    else this.set_status("applied");
    return this.state.status;
  }

  async validate(_ctx: HostContext): Promise<void> {
    if (typeof this.applyCmd !== "string" || this.applyCmd.trim().length === 0)
      throw new Error("exec: apply command must be a non-empty string");
  }

  async plan(_ctx: HostContext): Promise<ItemPlan | null> {
    const note = this.options?.always ? "always" : "noop";
    return { summary: `exec ${this.name} (${note})` };
  }

  async apply(ctx: HostContext): Promise<void> {
    const cwd = this.options?.cwd ?? ctx.user.home;
    if (!cwd) throw new Error("exec: host home directory is unknown; set options.cwd or ensure HostContext.user.home");
    const shell = this.options?.shell ?? (ctx.os === "win32" ? "cmd" : "sh");
    const env = { ...ctx.env.variables, ...(this.options?.env ?? {}) };
    const sudoOpt = this.options?.sudo;
    const res = this.plugin
      ? await this.plugin.run(this.applyCmd, { shell, cwd, env, sudo: sudoOpt, sudoUser: this.options?.sudoUser }, ctx)
      : await runShell(this.applyCmd, {
          shell,
          cwd,
          env,
          sudo: sudoOpt === "auto" ? ctx.os !== "win32" && !ctx.user.is_root && !!ctx.user.can_sudo : !!sudoOpt,
          sudoUser: this.options?.sudoUser,
        });
    if (!res.ok) throw new Error(`exec apply failed: ${res.stderr || "command error"}`);
  }

  async cleanup(ctx: HostContext): Promise<void> {
    if (!this.cleanupCmd) return;
    const cwd = this.options?.cwd ?? ctx.user.home;
    if (!cwd) throw new Error("exec: host home directory is unknown; set options.cwd or ensure HostContext.user.home");
    const shell = this.options?.shell ?? (ctx.os === "win32" ? "cmd" : "sh");
    const env = { ...ctx.env.variables, ...(this.options?.env ?? {}) };
    const sudoOpt = this.options?.sudo;
    const res = this.plugin
      ? await this.plugin.run(this.cleanupCmd, { shell, cwd, env, sudo: sudoOpt, sudoUser: this.options?.sudoUser }, ctx)
      : await runShell(this.cleanupCmd, {
          shell,
          cwd,
          env,
          sudo: sudoOpt === "auto" ? ctx.os !== "win32" && !ctx.user.is_root && !!ctx.user.can_sudo : !!sudoOpt,
          sudoUser: this.options?.sudoUser,
        });
    if (!res.ok) throw new Error(`exec cleanup failed: ${res.stderr || "command error"}`);
  }
}

