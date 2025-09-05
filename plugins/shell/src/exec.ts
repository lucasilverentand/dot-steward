import { execFile as _execFile } from "node:child_process";

export type ShellKind = "sh" | "bash" | "zsh" | "cmd" | "powershell";

export function runShell(
  cmd: string,
  opts?: {
    shell?: ShellKind;
    cwd?: string;
    env?: Record<string, string>;
    sudo?: boolean; // when true (on unix), execute via sudo -n -E
    sudoUser?: string; // optional target user for sudo -u
  },
): Promise<{
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}> {
  const shell = opts?.shell ?? "sh";
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
    file = "pwsh";
    args = [
      "-NoLogo",
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      cmd,
    ];
  } else {
    // cmd (Windows)
    file = "cmd.exe";
    args = ["/d", "/s", "/c", cmd];
  }

  const spawn = (exe: string, argv: string[], env?: Record<string, string>) =>
    new Promise<{
      ok: boolean;
      stdout: string;
      stderr: string;
      code: number | null;
    }>((resolve) => {
      const child = _execFile(
        exe,
        argv,
        {
          cwd: opts?.cwd,
          env,
          timeout: 30 * 60_000,
          maxBuffer: 2 * 1024 * 1024,
        },
        (err, stdout, stderr) => {
          let code: number | null = 0;
          if (err && typeof err === "object" && "code" in err) {
            const raw = (err as { code?: unknown }).code;
            code = typeof raw === "number" ? raw : 1;
          }
          resolve({
            ok: !err,
            stdout: stdout?.toString() ?? "",
            stderr: stderr?.toString() ?? "",
            code,
          });
        },
      );
      child.on("error", () =>
        resolve({ ok: false, stdout: "", stderr: "", code: -1 }),
      );
    });

  if (opts?.sudo) {
    // Only support sudo on unix shells; reject for Windows shells
    if (shell === "cmd" || shell === "powershell") {
      return Promise.resolve({
        ok: false,
        stdout: "",
        stderr: "sudo not supported on Windows shells",
        code: -1,
      });
    }
    const sudoArgs = ["-n", "-E"];
    if (opts.sudoUser && opts.sudoUser.trim().length > 0)
      sudoArgs.push("-u", opts.sudoUser.trim());
    sudoArgs.push(file, ...args);
    // With -E, forward provided env; sudo decides what to keep
    return spawn("sudo", sudoArgs, opts?.env);
  }
  return spawn(file, args, opts?.env);
}
