import { os as hostOS } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import { ExecPlugin } from "../../exec/src/plugin.ts";

export const MISE_MATCH = hostOS("linux", "darwin");

export async function isMiseInstalled(
  ctx: HostContext,
  shell?: ExecPlugin,
): Promise<boolean> {
  const cmd = await findMiseCmd(ctx, shell);
  if (!cmd) return false;
  const sh = shell ?? new ExecPlugin();
  const res = await sh.run(`${cmd} --version`, { shell: "bash" });
  return res.ok;
}

export async function ensureMiseInstalled(
  ctx: HostContext,
  shell?: ExecPlugin,
): Promise<void> {
  const sh = shell ?? new ExecPlugin();
  if (await isMiseInstalled(ctx, sh)) return;
  // Install via the requested setup method
  await sh.run("curl https://mise.run | sh", { shell: "bash" }, ctx);
}

export async function miseUseGlobal(
  tool: string,
  version: string | undefined,
  shell?: ExecPlugin,
  ctx?: HostContext,
): Promise<void> {
  const v = version && version.length > 0 ? version : "latest";
  const sh = shell ?? new ExecPlugin();
  let cmd = ctx ? await findMiseCmd(ctx, sh) : null;
  if (!cmd && ctx) {
    await ensureMiseInstalled(ctx, sh);
    cmd = await findMiseCmd(ctx, sh);
  }
  const exe = cmd ?? "mise";
  if (ctx) await ensureMiseConfigWritable(ctx, sh);
  const res = await sh.run(`${exe} use -g ${tool}@${v}`, { shell: "bash" }, ctx);
  if (!res.ok) {
    const msg = res.stderr || res.stdout || `mise use -g failed for ${tool}@${v}`;
    throw new Error(msg.trim());
  }
}

export async function miseWhich(
  tool: string,
  shell?: ExecPlugin,
  ctx?: HostContext,
): Promise<boolean> {
  const sh = shell ?? new ExecPlugin();
  const exe = ctx ? await findMiseCmd(ctx, sh) : null;
  const res = await sh.run(`${exe ?? "mise"} which ${tool}`, { shell: "bash" });
  return res.ok && res.stdout.trim().length > 0;
}

export async function miseCurrentMatches(
  tool: string,
  version: string | undefined,
  shell?: ExecPlugin,
  ctx?: HostContext,
): Promise<boolean> {
  const sh = shell ?? new ExecPlugin();
  const exe = ctx ? await findMiseCmd(ctx, sh) : null;
  const res = await sh.run(`${exe ?? "mise"} current ${tool}`, { shell: "bash" });
  if (!res.ok) return false;
  const out = res.stdout.trim();
  if (!version) return out.length > 0;
  const v = version.trim().toLowerCase();
  // For moving targets (aliases), consider any resolved version acceptable
  if (v === "latest" || v === "lts" || v === "system") return out.length > 0;
  // Otherwise require the concrete version to appear in the output
  return out.includes(version);
}

export async function findMiseCmd(
  ctx: HostContext,
  shell?: ExecPlugin,
): Promise<string | null> {
  const sh = shell ?? new ExecPlugin();
  // 1) PATH lookup
  const inPath = await sh.run("command -v mise", { shell: "bash" });
  if (inPath.ok && inPath.stdout.trim()) return inPath.stdout.trim();
  // 2) Well-known locations
  const home = ctx.user.home ?? "";
  const candidates = [
    ...(home ? [
      `${home}/.local/bin/mise`,
      `${home}/bin/mise`,
      `${home}/.cargo/bin/mise`,
    ] : []),
    "/opt/homebrew/bin/mise",
    "/usr/local/bin/mise",
    "/usr/bin/mise",
  ];
  for (const p of candidates) {
    const res = await sh.run(`[ -x "${p}" ] && printf "%s" "${p}" || true`, {
      shell: "bash",
    });
    const found = res.stdout.trim();
    if (found) return found;
  }
  return null;
}

async function ensureMiseConfigWritable(
  ctx: HostContext,
  shell?: ExecPlugin,
): Promise<void> {
  const sh = shell ?? new ExecPlugin();
  const home = ctx.user.home ?? "$HOME";
  const cfg = `${home}/.config/mise/config.toml`;
  const script = [
    // Ensure parent exists for ~/.config/mise
    `mkdir -p "${home}/.config/mise"`,
    // If cfg is a symlink and target missing, create target dir and empty file
    `if [ -L "${cfg}" ]; then TGT=$(readlink "${cfg}"); ` +
      `if [ ! -e "$TGT" ]; then mkdir -p "$(dirname "$TGT")" && : > "$TGT"; fi; ` +
    `else ` +
      // If not a symlink, ensure file exists
      `: > "${cfg}"; ` +
    `fi`,
  ].join(" && ");
  await sh.run(script, { shell: "bash" }, ctx);
}
