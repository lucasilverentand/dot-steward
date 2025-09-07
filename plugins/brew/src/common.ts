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

// Default environment to make Homebrew non-interactive and fast during checks
export function brewEnv(base?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...(base ?? process.env),
    HOMEBREW_NO_AUTO_UPDATE: "1",
    HOMEBREW_NO_ANALYTICS: "1",
    HOMEBREW_NO_INSTALL_CLEANUP: "1",
    HOMEBREW_COLOR: "1",
  };
}

export function execOk(
  cmd: string,
  args: string[] = [],
  opts?: { timeoutMs?: number; env?: NodeJS.ProcessEnv },
): Promise<boolean> {
  return new Promise((resolve) => {
    const child = _execFile(
      cmd,
      args,
      { timeout: opts?.timeoutMs ?? 30_000, env: opts?.env },
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
  return execOk(cmd, args, { env: brewEnv(), timeoutMs: 30_000 });
}

const _infoCache = new Map<string, boolean>();
export async function brewInfoOk(
  kind: "formula" | "cask",
  name: string,
): Promise<boolean> {
  const cmd = await findBrewCmd();
  if (!cmd) return false;
  const args = ["info", kind === "cask" ? "--cask" : "--formula", name];
  const key = `${kind}:${name}`;
  const cached = _infoCache.get(key);
  if (typeof cached === "boolean") return cached;
  const ok = await execOk(cmd, args, { timeoutMs: 30_000, env: brewEnv() });
  _infoCache.set(key, ok);
  return ok;
}

export async function brewTapExists(tap: string): Promise<boolean> {
  const cmd = await findBrewCmd();
  if (!cmd) return false;
  // tap-info returns non-zero when tap doesn't exist
  return execOk(cmd, ["tap-info", tap], { timeoutMs: 30_000, env: brewEnv() });
}

export async function brewExec(
  args: string[],
  opts?: { timeoutMs?: number; env?: NodeJS.ProcessEnv; useFastEnv?: boolean },
): Promise<void> {
  const cmd = await findBrewCmd();
  if (!cmd) throw new Error("brew not found in PATH or standard locations");
  await new Promise<void>((resolve, reject) => {
    const child = _execFile(
      cmd,
      args,
      {
        timeout: opts?.timeoutMs ?? 10 * 60_000,
        maxBuffer: 1024 * 1024,
        env:
          opts?.useFastEnv === false
            ? (opts?.env ?? process.env)
            : brewEnv(opts?.env ?? process.env),
      },
      (err) => {
        if (err) reject(err);
        else resolve();
      },
    );
    child.on("error", (e) => reject(e));
  });
}

// Determine if a specific brew package is outdated
export async function brewOutdated(
  kind: "formula" | "cask",
  name: string,
): Promise<boolean> {
  const cmd = await findBrewCmd();
  if (!cmd) return false;
  const args = [
    "outdated",
    "--quiet",
    kind === "cask" ? "--cask" : "--formula",
    name,
  ];
  const { ok, stdout } = await execCapture(cmd, args, {
    timeoutMs: 60_000,
    env: brewEnv(),
  });
  if (!ok) return false;
  const lines = stdout
    .split(/\r?\n/g)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length === 0) return false;
  // If brew printed the name (or any output) for this query, treat as outdated
  return lines.some((ln) => ln.includes(name));
}
