import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Item, os as hostOS } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import type { ItemPlan, ItemStatus } from "@dot-steward/core";

export type ShellKindSimple = "bash" | "zsh";
export type PathSpec = string[] | { prepend?: string[]; append?: string[] };
export type ShellProfileSpec = {
  paths?: PathSpec;
  aliases?: Record<string, string>;
  exports?: Record<string, string | number | boolean>;
  lines?: string[];
};
export type ShellProfileConfig = {
  universal?: ShellProfileSpec;
  bash?: ShellProfileSpec;
  zsh?: ShellProfileSpec;
  rcFiles?: Partial<Record<ShellKindSimple, string[]>>;
};

export class ShellProfile extends Item {
  readonly cfg: ShellProfileConfig;
  private readonly marker: string;
  readonly matches = hostOS("linux", "darwin");

  constructor(cfg: ShellProfileConfig) {
    super({ kind: "shell-config:profile" });
    this.cfg = cfg;
    const eff = {
      bash: materializeSpec(cfg.universal, cfg.bash),
      zsh: materializeSpec(cfg.universal, cfg.zsh),
    };
    const sig = stableStringify(eff);
    this.marker = `shell:profile:${hashString(sig)}`;
  }

  render(): string {
    const shells = this.enabledShells().join(",");
    return `[shell:profile] ${shells}`;
  }

  async probe(ctx: HostContext): Promise<ItemStatus> {
    const shells = this.enabledShells();
    for (const sh of shells) {
      const files = this.targetRcFiles(sh, ctx);
      const desired = this.renderBlock(sh);
      for (const f of files) {
        const abs = resolveHome(f, ctx);
        const cur = await readText(abs);
        const existing = extractManagedBlock(cur, this.marker);
        if (existing === null || normalizeEOL(existing) !== normalizeEOL(desired)) {
          this.set_status("pending");
          return this.state.status;
        }
      }
    }
    this.set_status("applied");
    return this.state.status;
  }

  async validate(_ctx: HostContext): Promise<void> {}

  async plan(_ctx: HostContext): Promise<ItemPlan | null> {
    const shells = this.enabledShells();
    const stats = this.summaryStats();
    const parts = [
      `shells=${shells.join("+")}`,
      stats.paths > 0 ? `paths:${stats.paths}` : undefined,
      stats.aliases > 0 ? `aliases:${stats.aliases}` : undefined,
      stats.exports > 0 ? `exports:${stats.exports}` : undefined,
      stats.lines > 0 ? `lines:${stats.lines}` : undefined,
    ].filter(Boolean);
    return { summary: `shell:profile ${parts.join(" ")}` };
  }

  async apply(ctx: HostContext): Promise<void> {
    const shells = this.enabledShells();
    for (const sh of shells) {
      const files = this.targetRcFiles(sh, ctx);
      const desired = this.renderBlock(sh);
      for (const f of files) {
        const abs = resolveHome(f, ctx);
        const dir = path.dirname(abs);
        await fs.mkdir(dir, { recursive: true });
        const cur = await readText(abs);
        const next = upsertManagedBlock(cur, this.marker, desired);
        await fs.writeFile(abs, next, "utf8");
      }
    }
  }

  async cleanup(ctx: HostContext): Promise<void> {
    const shells = this.enabledShells();
    for (const sh of shells) {
      const files = this.targetRcFiles(sh, ctx);
      for (const f of files) {
        const abs = resolveHome(f, ctx);
        const cur = await readText(abs);
        if (cur.length === 0) continue;
        const next = removeManagedBlock(cur, this.marker);
        if (next !== null) await fs.writeFile(abs, next, "utf8");
      }
    }
  }

  dedupe_key(): string { return this.marker; }

  private enabledShells(): ShellKindSimple[] {
    const shells: ShellKindSimple[] = [];
    if (this.cfg.zsh || this.cfg.universal) shells.push("zsh");
    if (this.cfg.bash || this.cfg.universal) shells.push("bash");
    return Array.from(new Set(shells));
  }

  private targetRcFiles(sh: ShellKindSimple, ctx: HostContext): string[] {
    const overrides = this.cfg.rcFiles?.[sh];
    if (overrides && overrides.length > 0) return overrides;
    const home = ctx.user.home || "~";
    if (sh === "zsh") return [path.join(home, ".zshrc")];
    return [path.join(home, ".bashrc"), path.join(home, ".bash_profile")];
  }

  private summaryStats(): { paths: number; aliases: number; exports: number; lines: number } {
    const merge = (a?: ShellProfileSpec, b?: ShellProfileSpec) => ({
      paths: countPaths(a?.paths) + countPaths(b?.paths),
      aliases: Object.keys({ ...(a?.aliases ?? {}), ...(b?.aliases ?? {}) }).length,
      exports: Object.keys({ ...(a?.exports ?? {}), ...(b?.exports ?? {}) }).length,
      lines: (a?.lines?.length ?? 0) + (b?.lines?.length ?? 0),
    });
    const bash = merge(this.cfg.universal, this.cfg.bash);
    const zsh = merge(this.cfg.universal, this.cfg.zsh);
    return {
      paths: Math.max(bash.paths, zsh.paths),
      aliases: Math.max(bash.aliases, zsh.aliases),
      exports: Math.max(bash.exports, zsh.exports),
      lines: Math.max(bash.lines, zsh.lines),
    };
  }

  private renderBlock(sh: ShellKindSimple): string {
    const eff: ShellProfileSpec = mergeSpec(this.cfg.universal, this.cfg[sh]);
    const lines: string[] = [];
    const pathSpec = normalizePathSpec(eff.paths);
    if (pathSpec.prepend.length > 0) {
      const parts = pathSpec.prepend.map((p) => quotePath(p)).join(":");
      lines.push(`export PATH="${parts}:$PATH"`);
    }
    if (pathSpec.append.length > 0) {
      const parts = pathSpec.append.map((p) => quotePath(p)).join(":");
      lines.push(`export PATH="$PATH:${parts}"`);
    }
    for (const [k, v] of Object.entries(eff.exports ?? {})) {
      lines.push(`export ${k}=${dq(String(v))}`);
    }
    for (const [k, v] of Object.entries(eff.aliases ?? {})) {
      lines.push(`alias ${k}=${sq(v)}`);
    }
    if (eff.lines && eff.lines.length > 0) lines.push(...eff.lines);
    return `${lines.join("\n")}${lines.length > 0 ? "\n" : ""}`;
  }
}

// Helpers
function resolveHome(p: string, ctx: HostContext): string {
  if (path.isAbsolute(p)) return p;
  const home = ctx.user.home;
  if (!home) return path.resolve(p.replace(/^~\//, "/"));
  return p.startsWith("~/") ? path.join(home, p.slice(2)) : path.join(home, p);
}
async function readText(abs: string): Promise<string> {
  try { return await fs.readFile(abs, "utf8"); } catch { return ""; }
}
function countPaths(spec?: PathSpec): number { const n = normalizePathSpec(spec); return n.prepend.length + n.append.length; }
function normalizePathSpec(spec?: PathSpec): { prepend: string[]; append: string[] } { if (!spec) return { prepend: [], append: [] }; if (Array.isArray(spec)) return { prepend: spec, append: [] }; return { prepend: spec.prepend ?? [], append: spec.append ?? [] }; }
function mergeSpec(a?: ShellProfileSpec, b?: ShellProfileSpec): ShellProfileSpec { return { paths: mergePathSpec(a?.paths, b?.paths), aliases: { ...(a?.aliases ?? {}), ...(b?.aliases ?? {}) }, exports: { ...(a?.exports ?? {}), ...(b?.exports ?? {}) }, lines: [...(a?.lines ?? []), ...(b?.lines ?? [])] }; }
function mergePathSpec(a?: PathSpec, b?: PathSpec): PathSpec | undefined { if (!a && !b) return undefined; const na = normalizePathSpec(a); const nb = normalizePathSpec(b); return { prepend: [...na.prepend, ...nb.prepend], append: [...na.append, ...nb.append] }; }
function quotePath(p: string): string { if (p.startsWith("~/")) return `$HOME/${p.slice(2)}`; if (p.includes("$")) return p; return p.replace(/"/g, '\\"'); }
function sq(s: string): string { return "'" + s.replace(/'/g, "'\\''") + "'"; }
function dq(v: string): string { return '"' + v.replace(/"/g, '\\"') + '"'; }
function normalizeEOL(s: string): string { return s.replace(/\r\n/g, "\n"); }
function blockMarkers(id: string): { start: string; end: string } { return { start: `# >>> dot-steward:shell profile ${id} >>>`, end: `# <<< dot-steward:shell profile ${id} <<<` }; }
function extractManagedBlock(content: string, id: string): string | null { const { start, end } = blockMarkers(id); const s = content.indexOf(start); if (s === -1) return null; const e = content.indexOf(end, s + start.length); if (e === -1) return null; const inner = content.slice(s + start.length, e); return inner.replace(/^\n/, "").replace(/\n$/, "\n"); }
function upsertManagedBlock(content: string, id: string, block: string): string { const { start, end } = blockMarkers(id); const has = extractManagedBlock(content, id); const wrapped = `${start}\n${block}${end}\n`; if (has === null) { const trimmed = content.endsWith("\n") || content.length === 0 ? content : content + "\n"; return trimmed + wrapped; } const s = content.indexOf(start); const e = content.indexOf(end, s + start.length); return content.slice(0, s) + wrapped + content.slice(e + end.length + 1); }
function removeManagedBlock(content: string, id: string): string | null { const { start, end } = blockMarkers(id); const s = content.indexOf(start); if (s === -1) return null; const e = content.indexOf(end, s + start.length); if (e === -1) return null; const before = content.slice(0, s); const after = content.slice(e + end.length + 1); return before + after; }
function materializeSpec(base?: ShellProfileSpec, extra?: ShellProfileSpec) { const merged = mergeSpec(base, extra); const paths = normalizePathSpec(merged.paths); const aliasesEntries = Object.entries(merged.aliases ?? {}).sort((a,b)=>a[0].localeCompare(b[0])); const exportsEntries = Object.entries(merged.exports ?? {}).sort((a,b)=>a[0].localeCompare(b[0])); return { paths, aliases: Object.fromEntries(aliasesEntries), exports: Object.fromEntries(exportsEntries), lines: [...(merged.lines ?? [])] }; }
function stableStringify(v: unknown): string { if (v === null || typeof v !== "object") return JSON.stringify(v); if (Array.isArray(v)) return `[${v.map((x)=>stableStringify(x)).join(",")}]`; const obj = v as Record<string, unknown>; const keys = Object.keys(obj).sort((a,b)=>a.localeCompare(b)); return `{${keys.map((k)=>`${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`; }
function hashString(s: string): string { let h = 5381 >>> 0; for (let i=0;i<s.length;i++){ h = (((h<<5)+h) ^ s.charCodeAt(i)) >>> 0; } return h.toString(16); }
