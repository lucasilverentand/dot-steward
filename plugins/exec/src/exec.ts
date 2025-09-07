import { spawn } from "node:child_process";

export type ShellKind = "sh" | "bash" | "zsh" | "cmd" | "powershell";

export async function runShell(
  command: string,
  opts?: {
    shell?: ShellKind;
    cwd?: string;
    env?: Record<string, string>;
    sudo?: boolean;
    sudoUser?: string;
  },
): Promise<{
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}> {
  const shell = opts?.shell ?? "sh";
  const env = { ...process.env, ...(opts?.env ?? {}) };
  const cwd = opts?.cwd ?? process.cwd();
  let cmd = command;
  if (opts?.sudo && process.platform !== "win32") {
    const target = opts.sudoUser ? `-u ${opts.sudoUser}` : "";
    cmd = `sudo ${target} sh -lc ${JSON.stringify(command)}`.trim();
  }
  const args =
    shell === "cmd"
      ? ["/d", "/s", "/c", command]
      : shell === "powershell"
        ? ["-NoLogo", "-NonInteractive", "-Command", command]
        : ["-lc", command];
  const bin = shell === "cmd" ? "cmd.exe" : shell === "powershell" ? "powershell" : "/bin/bash";
  return new Promise((resolve) => {
    const child = spawn(bin, args, { cwd, env });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolve({ ok: code === 0, stdout, stderr, code }));
    child.on("error", () => resolve({ ok: false, stdout: "", stderr: "spawn error", code: null }));
  });
}

