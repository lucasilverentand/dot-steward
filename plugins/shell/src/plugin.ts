import { Plugin } from "@dot-steward/core";
import { os as hostOS } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import type { ItemStatus } from "@dot-steward/core";
import { runShell, type ShellKind } from "./exec.ts";
import { spawnSync } from "node:child_process";

export class ShellPlugin extends Plugin {
  constructor() {
    super("shell", hostOS("linux", "darwin", "win32"));
  }

  async probe(_ctx: HostContext): Promise<ItemStatus> {
    // Shell is assumed available on all supported platforms
    this.set_status("applied");
    return this.state.status;
  }

  async apply(_ctx: HostContext): Promise<void> {
    // No-op: shell plugin provides command items
  }

  // Allow other plugins to run shell commands via this plugin.
  async run(
    cmd: string,
    opts?: {
      shell?: ShellKind;
      cwd?: string;
      env?: Record<string, string>;
      sudo?: boolean | "auto";
      sudoUser?: string;
    },
    ctx?: HostContext, // optional: when provided and sudo:"auto", use ctx.user flags
  ): Promise<{ ok: boolean; stdout: string; stderr: string; code: number | null }> {
    let useSudo = false;
    if (opts?.sudo === true) useSudo = true;
    else if (opts?.sudo === "auto") {
      if (ctx && ctx.os !== "win32") useSudo = !ctx.user.is_root && !!ctx.user.can_sudo;
    }
    let res = await runShell(cmd, {
      shell: opts?.shell,
      cwd: opts?.cwd,
      env: opts?.env,
      sudo: useSudo,
      sudoUser: opts?.sudoUser,
    });
    // If sudo was requested and failed due to missing credentials, prompt once
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
          // Retry with sudo; timestamp should now be valid
          res = await runShell(cmd, {
            shell: opts?.shell,
            cwd: opts?.cwd,
            env: opts?.env,
            sudo: true,
            sudoUser: opts?.sudoUser,
          });
        }
      } catch {
        // ignore, return original result
      }
    }
    return res;
  }
}

export function shellPlugin(): ShellPlugin {
  return new ShellPlugin();
}
