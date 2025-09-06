import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { execFile as _execFile, spawnSync } from "node:child_process";
import pc from "picocolors";
import type { Manager } from "@dot-steward/core";
import type { LastApply } from "../state.ts";
import type { RemovalCandidate } from "./removals.ts";

export type RemovalTask = RemovalCandidate & {
  run: () => Promise<void>;
};

function execOk(
  cmd: string,
  args: string[],
  opts?: { timeoutMs?: number; env?: NodeJS.ProcessEnv },
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
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

function expandHome(p: string): string {
  if (!p.startsWith("~")) return p;
  const home = os.homedir();
  return path.resolve(home, p.slice(1));
}

function buildTaskForBrew(kind: string, label: string): RemovalTask | null {
  const m = label.match(/^\[brew:(formula|cask)\]\s+(.+)$/);
  if (!m) return null;
  const pkgKind = m[1] as "formula" | "cask";
  const name = m[2].trim();
  const args = pkgKind === "cask" ? ["uninstall", "--cask", name] : ["uninstall", name];
  return {
    id: `rem-brew:${pkgKind}:${name}`,
    kind,
    label,
    run: async () => {
      const { ok, stderr } = await execOk("brew", args, { timeoutMs: 15 * 60_000 });
      if (!ok) throw new Error(stderr || `brew uninstall failed for ${name}`);
    },
  };
}

function buildTaskForAppStore(
  kind: string,
  label: string,
  mgr: Manager,
): RemovalTask | null {
  // Expect label like "[app-store] Name (123456789)" or "[app-store] 123456789"
  const idMatch = label.match(/\((\d{4,})\)\s*$/) || label.match(/\b(\d{4,})\b/);
  const id = idMatch?.[1];
  if (!id) return null;
  return {
    id: `rem-appstore:${id}`,
    kind,
    label,
    run: async () => {
      // Try normal uninstall first
      let res = await execOk("mas", ["uninstall", id], { timeoutMs: 15 * 60_000 });
      if (res.ok) return;
      // If it failed and we can sudo on macOS and not root, attempt with sudo
      const canElevate =
        mgr.host.os === "darwin" && !mgr.host.user.is_root && !!mgr.host.user.can_sudo;
      if (canElevate) {
        // First try non-interactive sudo (timestamp may already be valid)
        res = await execOk(
          "sudo",
          ["-n", "-E", "mas", "uninstall", id],
          { timeoutMs: 15 * 60_000, env: process.env },
        );
        if (!res.ok && process.stdin.isTTY && process.stdout.isTTY) {
          // Prompt once to refresh sudo timestamp, then retry elevated
          try {
            const r = spawnSync("sudo", ["-v"], { stdio: "inherit" });
            if (r.status === 0) {
              res = await execOk(
                "sudo",
                ["-E", "mas", "uninstall", id],
                { timeoutMs: 15 * 60_000, env: process.env },
              );
            }
          } catch {
            // ignore and fall through to error
          }
        }
      }
      if (!res.ok) throw new Error(res.stderr || `mas uninstall failed for ${id}`);
    },
  };
}

function buildTaskForFile(kind: string, label: string): RemovalTask | null {
  // label is rendered path for file items, e.g., "/abs" or "~/path"
  const p = expandHome(label.startsWith("[") ? label.replace(/^\[[^\]]+\]\s*/, "") : label);
  // Avoid removing directories inadvertently; we expect files
  return {
    id: `rem-file:${p}`,
    kind,
    label,
    run: async () => {
      try {
        const st = await fs.stat(p);
        if (st.isDirectory()) throw new Error("path is a directory; skipping");
      } catch {
        // If it doesn't exist, consider already removed
        return;
      }
      await fs.rm(p, { force: true });
    },
  };
}

export function buildRemovalTasks(
  mgr: Manager,
  removed: RemovalCandidate[],
): RemovalTask[] {
  const tasks: RemovalTask[] = [];
  for (const r of removed) {
    const k = r.kind;
    if (k === "brew:formula" || k === "brew:cask") {
      const t = buildTaskForBrew(k, r.label);
      if (t) tasks.push(t);
      continue;
    }
    if (k === "app-store:app") {
      const t = buildTaskForAppStore(k, r.label, mgr);
      if (t) tasks.push(t);
      continue;
    }
    if (k === "file:content" || k === "file:copy") {
      const t = buildTaskForFile(k, r.label);
      if (t) tasks.push(t);
      continue;
    }
    // Other kinds currently unsupported for automatic removal
  }
  return tasks;
}

export async function runRemovalTasksWithUI(tasks: RemovalTask[]): Promise<{ ok: number; err: number }> {
  type Status = "pending" | "running" | "done" | "error" | "skip";
  type Row = { title: string; status: Status; note?: string };
  const rows: Row[] = tasks.map((t) => ({ title: t.label, status: "pending" }));

  const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let spinnerIdx = 0;
  const isTTY = !!process.stdin.isTTY && !!process.stdout.isTTY;
  let printed = 0;
  let timer: NodeJS.Timeout | null = null;

  const symbol = (row: Row): string => {
    switch (row.status) {
      case "pending":
        return pc.red(pc.dim("!"));
      case "running":
        return pc.red(spinnerFrames[spinnerIdx % spinnerFrames.length]);
      case "done":
        return pc.red("✔");
      case "skip":
        return pc.red("↷");
      case "error":
        return pc.red("✖");
    }
  };

  const draw = () => {
    const header = "◆  Removals";
    const lines: string[] = ["│", header, "│", "├─ Items"]; // single section
    for (const r of rows) lines.push(`│  ${symbol(r)} ${r.title}${r.note ? ` ${pc.dim("(")}${r.note}${pc.dim(")")}` : ""}`);
    lines.push("└");
    if (isTTY && printed > 0) process.stdout.write(`\x1b[${printed}A\x1b[J`);
    process.stdout.write(lines.join("\n") + "\n");
    printed = lines.length;
  };

  const start = () => {
    if (!isTTY || timer) return;
    timer = setInterval(() => {
      spinnerIdx = (spinnerIdx + 1) % spinnerFrames.length;
      if (rows.some((r) => r.status === "running")) draw();
    }, 80);
  };
  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  draw();
  start();
  let ok = 0;
  let err = 0;
  let appStoreFailed = false;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const task = tasks[i];
    // If an App Store removal failed earlier, skip removal of the 'mas' formula
    if (
      appStoreFailed &&
      task.kind === "brew:formula" &&
      /\[brew:formula\]\s+mas(\s|$)/.test(task.label)
    ) {
      r.status = "skip";
      r.note = "skipped: depends on app-store removals";
      draw();
      continue;
    }

    r.status = "running";
    draw();
    try {
      await task.run();
      r.status = "done";
      r.note = undefined;
      ok++;
      draw();
    } catch (e) {
      r.status = "error";
      r.note = e instanceof Error ? e.message : String(e);
      if (task.kind.startsWith("app-store")) appStoreFailed = true;
      err++;
      draw();
    }
  }
  stop();
  return { ok, err };
}
