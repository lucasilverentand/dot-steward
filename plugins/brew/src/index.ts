import type { ManagedItem, Plugin as PluginContract } from "@dot-steward/types";
import { Plugin } from "@dot-steward/types";

type Desired = string | { name: string; version?: string };

function normalizeDesired(d: unknown): { name: string; version?: string } | null {
  if (!d) return null;
  if (typeof d === "string") return { name: d };
  if (typeof d === "object" && d !== null) {
    const obj = d as Record<string, unknown>;
    const name = obj.name as unknown;
    const version = (obj as Record<string, unknown>).version as unknown;
    if (typeof name === "string") {
      return { name, version: typeof version === "string" ? version : undefined };
    }
  }
  return null;
}

function hasBrew(): boolean {
  try {
    const r = Bun.spawnSync({ cmd: ["brew", "--version"], stdout: "ignore", stderr: "ignore" });
    return r.exitCode === 0;
  } catch {
    return false;
  }
}

function brewInstalledVersion(name: string): string | null {
  try {
    const r = Bun.spawnSync({ cmd: ["brew", "list", "--formula", "--versions", name] });
    if (r.exitCode !== 0) return null;
    const out = new TextDecoder().decode(r.stdout).trim();
    if (!out) return null;
    const parts = out.split(/\s+/);
    // Format: "<name> <version>"
    if (parts[0] !== name) return null;
    return parts[1] ?? null;
  } catch {
    return null;
  }
}

function brewHasTap(name: string): boolean {
  try {
    const r = Bun.spawnSync({ cmd: ["brew", "tap"] });
    if (r.exitCode !== 0) return false;
    const out = new TextDecoder().decode(r.stdout).trim();
    const taps = out.split(/\r?\n/).filter(Boolean);
    return taps.includes(name);
  } catch {
    return false;
  }
}

export class BrewPlugin implements PluginContract {
  readonly id = "brew" as const;
  private readonly instance = Plugin
    .define("brew")
    .capability("brew.formula", undefined, { provides: ["package"], description: "Manage Homebrew formulas" })
    .capability("brew.tap", undefined, { provides: ["brew.tap"], description: "Manage Homebrew taps" })
    .ready(({ host }) => {
    const isDarwin = host.os === "darwin";
    const isLinuxbrew = host.os === "linux" && !!host.env.HOMEBREW_PREFIX;
    const ok = isDarwin || isLinuxbrew;
    return ok
      ? { status: "ready" }
      : {
          status: "not_ready",
          checks: [
            {
              name: "platform",
              ok,
              details: "Requires macOS with Homebrew or Linuxbrew installed",
            },
          ],
        };
  })
  .supports((item, { host }) => {
    if (item.kind !== "package") return false;
    return host.os === "darwin" || (host.os === "linux" && !!host.env.HOMEBREW_PREFIX);
  })
  .on("brew.formula", {
    probe: (item) => {
      const d = normalizeDesired(item.spec as Desired);
      if (!d) return {};
      return { installedVersion: hasBrew() ? brewInstalledVersion(d.name) : null };
    },
    diff: (_current, desired) => {
      const d = normalizeDesired(desired as Desired);
      const okPlatform = hasBrew();
      const installed = d && okPlatform ? brewInstalledVersion(d.name) : null;
      const changed = !installed || (d?.version && d.version !== installed);
      return {
        current: installed,
        desired: d ?? desired,
        idempotent: true,
        changes: changed
          ? [{ path: `brew.formula:${d?.name ?? "unknown"}`, from: installed ?? undefined, to: d?.version ?? "present" }]
          : [],
      };
    },
    action: (node) => {
      const spec = (node.metadata?.spec ?? null) as unknown;
      const d = normalizeDesired(spec);
      if (!d) throw new Error("Invalid spec for brew.formula action");
      if (!hasBrew()) throw new Error("Homebrew not available");
      if (node.action === "destroy") {
        const r = Bun.spawnSync({ cmd: ["brew", "uninstall", d.name] });
        if (r.exitCode !== 0) {
          throw new Error(new TextDecoder().decode(r.stderr) || `brew uninstall failed for ${d.name}`);
        }
      } else {
        const r = Bun.spawnSync({ cmd: ["brew", "install", d.name] });
        if (r.exitCode !== 0) {
          throw new Error(new TextDecoder().decode(r.stderr) || `brew install failed for ${d.name}`);
        }
      }
    },
  })
  .on("brew.tap", {
    diff: (_current, desired) => {
      const d = normalizeDesired(desired as Desired);
      const name = d?.name ?? String(desired ?? "");
      const tapped = hasBrew() ? brewHasTap(name) : false;
      return {
        current: tapped ? "present" : null,
        desired: { name },
        idempotent: true,
        changes: tapped ? [] : [{ path: `brew.tap:${name}`, from: undefined, to: "present" }],
      };
    },
    action: (node) => {
      const spec = (node.metadata?.spec ?? null) as unknown;
      const d = normalizeDesired(spec);
      const name = d?.name ?? String(spec ?? "");
      if (!hasBrew()) throw new Error("Homebrew not available");
      if (brewHasTap(name)) return; // idempotent
      const r = Bun.spawnSync({ cmd: ["brew", "tap", name] });
      if (r.exitCode !== 0) {
        throw new Error(new TextDecoder().decode(r.stderr) || `brew tap failed for ${name}`);
      }
    },
  })
  .action(() => {
    // No-op placeholder
  })
    .build();

  // Expose SDK-shaped fields by delegation
  get manifest() { return this.instance.manifest; }
  get handlers() { return this.instance.handlers; }
  get readiness() { return this.instance.readiness; }
  get capabilityHandlers() { return this.instance.capabilityHandlers; }
  get supports() { return this.instance.supports; }

  // Item helpers for fluent usage
  formula(spec: Desired): ManagedItem<Desired> {
    const d = normalizeDesired(spec) ?? { name: String(spec) };
    return {
      id: `brew:${d.name}`,
      kind: "package",
      spec: d,
      owner: "brew",
    };
  }

  tap(name: string): ManagedItem<{ name: string }> {
    return {
      id: `brew.tap:${name}`,
      kind: "brew.tap",
      spec: { name },
      owner: "brew",
    };
  }
}

export function brew() {
  return new BrewPlugin();
}

export default brew;
