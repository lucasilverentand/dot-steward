import { spawnSync } from "node:child_process";
import { Plugin } from "@dot-steward/core";
import { os as hostOS } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import type { ItemStatus } from "@dot-steward/core";
import { type ShellKind, runShell } from "./exec.ts";

export class ExecPlugin extends Plugin {
  constructor() {
    super("exec", hostOS("linux", "darwin", "win32"));
  }

  async probe(_ctx: HostContext): Promise<ItemStatus> {
    this.set_status("applied");
    return this.state.status;
  }

  async apply(_ctx: HostContext): Promise<void> {
    // no-op
  }

  async run(
    cmd: string,
    opts?: {
      shell?: ShellKind;
      cwd?: string;
      env?: Record<string, string>;
      sudo?: boolean | "auto";
      sudoUser?: string;
    },
    ctx?: HostContext,
  ): Promise<{
    ok: boolean;
    stdout: string;
    stderr: string;
    code: number | null;
  }> {
    let useSudo = false;
    if (opts?.sudo === true) useSudo = true;
    else if (opts?.sudo === "auto") {
      if (ctx && ctx.os !== "win32")
        useSudo = !ctx.user.is_root && !!ctx.user.can_sudo;
    }
    let res = await runShell(cmd, {
      shell: opts?.shell,
      cwd: opts?.cwd,
      env: opts?.env,
      sudo: useSudo,
      sudoUser: opts?.sudoUser,
    });
    if (
      useSudo &&
      !res.ok &&
      ctx &&
      ctx.os !== "win32" &&
      !ctx.user.is_root &&
      ctx.user.can_sudo
    ) {
      try {
        const r = spawnSync("sudo", ["-v"], { stdio: "inherit" });
        if (r.status === 0) {
          res = await runShell(cmd, {
            shell: opts?.shell,
            cwd: opts?.cwd,
            env: opts?.env,
            sudo: true,
            sudoUser: opts?.sudoUser,
          });
        }
      } catch {}
    }
    return res;
  }
}

export function execPlugin(): ExecPlugin {
  return new ExecPlugin();
}
