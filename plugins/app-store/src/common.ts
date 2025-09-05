import { execFile as _execFile } from "node:child_process";

export const MAS_CANDIDATES = [
  "mas",
  "/opt/homebrew/bin/mas",
  "/usr/local/bin/mas",
];

function execOk(cmd: string, args: string[] = [], timeoutMs = 30000): Promise<boolean> {
  return new Promise((resolve) => {
    const child = _execFile(cmd, args, { timeout: timeoutMs }, (err) => {
      resolve(!err);
    });
    child.on("error", () => resolve(false));
  });
}

export async function findMasCmd(): Promise<string | null> {
  if (await execOk("mas", ["version"], 10000)) return "mas";
  for (const p of MAS_CANDIDATES.slice(1)) {
    if (await execOk(p, ["version"], 10000)) return p;
  }
  return null;
}

export function masExec(
  args: string[],
  opts?: { timeoutMs?: number; env?: NodeJS.ProcessEnv },
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise(async (resolve) => {
    const cmd = (await findMasCmd()) ?? "mas"; // last-ditch: try PATH
    const child = _execFile(
      cmd,
      args,
      {
        timeout: opts?.timeoutMs ?? 10 * 60_000,
        maxBuffer: 1024 * 1024,
        env: opts?.env ?? process.env,
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

export async function masOk(args: string[]): Promise<boolean> {
  const { ok } = await masExec(args, { timeoutMs: 30_000 });
  return ok;
}

