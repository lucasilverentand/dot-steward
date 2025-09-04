import { Item } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import type { ItemPlan, ItemStatus } from "@dot-steward/core";
import { execFile as _execFile } from "node:child_process";
import * as os from "node:os";
import { ShellPlugin } from "./plugin.ts";

export type ShellKind = "sh" | "bash" | "zsh" | "cmd" | "powershell";

export type ShellCommandOptions = {
  shell?: ShellKind;
  cwd?: string;
  env?: Record<string, string>;
  // If true, always considered pending to run on apply, no cleanup expected
  always?: boolean;
};

export class ShellCommand extends Item {
  readonly name: string;
  readonly plugin?: ShellPlugin;
  readonly plugin_key = "shell";
  readonly matches = { type: "any", of: [{ type: "os", values: ["linux", "darwin", "win32"] }] } as const;

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
    const home = ctx.user.home ?? process.env.HOME ?? os.homedir();
    const { ok, stderr } = await runShell(this.applyCmd, {
      ...this.options,
      cwd: this.options?.cwd ?? home ?? process.cwd(),
    });
    if (!ok) throw new Error(`shell apply failed: ${stderr || "command error"}`);
  }

  async cleanup(ctx: HostContext): Promise<void> {
    if (!this.cleanupCmd) return; // optional one-way commands have no cleanup
    const home = ctx.user.home ?? process.env.HOME ?? os.homedir();
    const { ok, stderr } = await runShell(this.cleanupCmd, {
      ...this.options,
      cwd: this.options?.cwd ?? home ?? process.cwd(),
    });
    if (!ok) throw new Error(`shell cleanup failed: ${stderr || "command error"}`);
  }
}

function runShell(
  cmd: string,
  opts?: { shell?: ShellKind; cwd?: string; env?: Record<string, string> },
): Promise<{ ok: boolean; stdout: string; stderr: string; code: number | null }> {
  const shell = opts?.shell ?? (process.platform === "win32" ? "cmd" : "sh");
  let file = "";
  let args: string[] = [];
  if (shell === "sh") {
    file = "/bin/sh";
    args = ["-lc", cmd];
  } else if (shell === "bash") {
    file = "/bin/bash";
    args = ["-lc", cmd];
  } else if (shell === "zsh") {
    file = "/bin/zsh";
    args = ["-lc", cmd];
  } else if (shell === "powershell") {
    file = process.platform === "win32" ? "powershell.exe" : "pwsh";
    args = ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd];
  } else {
    // cmd (Windows)
    file = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
    args = process.platform === "win32" ? ["/d", "/s", "/c", cmd] : ["-lc", cmd];
  }

  return new Promise((resolve) => {
    const child = _execFile(
      file,
      args,
      {
        cwd: opts?.cwd,
        env: { ...process.env, ...(opts?.env ?? {}) },
        timeout: 30 * 60_000,
        maxBuffer: 2 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        resolve({ ok: !err, stdout: stdout?.toString() ?? "", stderr: stderr?.toString() ?? "", code: (err as any)?.code ?? 0 });
      },
    );
    child.on("error", () => resolve({ ok: false, stdout: "", stderr: "", code: -1 }));
  });
}
