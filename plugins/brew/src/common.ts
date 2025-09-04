import { execFile as _execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { os as hostOS } from "@dot-steward/core";

export const BREW_CANDIDATES = [
  "brew",
  "/opt/homebrew/bin/brew", // macOS Apple Silicon
  "/usr/local/bin/brew", // macOS Intel
  "/home/linuxbrew/.linuxbrew/bin/brew", // Linuxbrew default
];

// Homebrew is meaningful on macOS and Linux only
export const BREW_MATCH = hostOS("darwin", "linux");

export function execOk(
  cmd: string,
  args: string[] = [],
  opts?: { timeoutMs?: number },
): Promise<boolean> {
  return new Promise((resolve) => {
    const child = _execFile(
      cmd,
      args,
      { timeout: opts?.timeoutMs ?? 30_000 },
      (err) => {
        resolve(!err);
      },
    );
    child.on("error", () => resolve(false));
  });
}

export function execCapture(
  cmd: string,
  args: string[] = [],
  opts?: { timeoutMs?: number; env?: NodeJS.ProcessEnv },
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = _execFile(
      cmd,
      args,
      {
        timeout: opts?.timeoutMs ?? 60_000,
        maxBuffer: 1024 * 1024,
        env: opts?.env,
      },
      (err, stdout, stderr) => {
        resolve({
          ok: !err,
          stdout: stdout?.toString() ?? "",
          stderr: stderr?.toString() ?? "",
        });
      },
    );
    child.on("error", () => resolve({ ok: false, stdout: "", stderr: "" }));
  });
}

export async function findBrewCmd(): Promise<string | null> {
  // Try PATH first
  if (await execOk("brew", ["--version"], { timeoutMs: 10_000 })) return "brew";
  for (const p of BREW_CANDIDATES.slice(1)) {
    try {
      await access(p);
      if (await execOk(p, ["--version"], { timeoutMs: 10_000 })) return p;
    } catch {
      // ignore
    }
  }
  return null;
}

export async function brewExecOk(args: string[]): Promise<boolean> {
  const cmd = await findBrewCmd();
  if (!cmd) return false;
  return execOk(cmd, args);
}

export async function brewExec(
  args: string[],
  opts?: { timeoutMs?: number },
): Promise<void> {
  const cmd = await findBrewCmd();
  if (!cmd) throw new Error("brew not found in PATH or standard locations");
  await new Promise<void>((resolve, reject) => {
    const child = _execFile(
      cmd,
      args,
      { timeout: opts?.timeoutMs ?? 10 * 60_000, maxBuffer: 1024 * 1024 },
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
    child.on("error", (e) => reject(e));
  });
}
