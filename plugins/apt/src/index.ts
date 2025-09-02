import type { ManagedItem } from "@dot-steward/types";
import { Plugin } from "@dot-steward/types";

type Desired = string | { name: string; version?: string };

function normalizeDesired(d: unknown): { name: string; version?: string } | null {
  if (!d) return null;
  if (typeof d === "string") return { name: d };
  if (typeof d === "object" && d !== null) {
    const obj = d as Record<string, unknown>;
    const name = obj["name"];
    const version = obj["version"];
    if (typeof name === "string") {
      return { name, version: typeof version === "string" ? version : undefined };
    }
  }
  return null;
}

function hasApt(): boolean {
  try {
    const r = Bun.spawnSync({ cmd: ["apt-get", "--version"], stdout: "ignore", stderr: "ignore" });
    return r.exitCode === 0;
  } catch {
    return false;
  }
}

function dpkgVersion(name: string): string | null {
  try {
    const r = Bun.spawnSync({ cmd: ["dpkg-query", "-W", "-f=${Version}", name] });
    if (r.exitCode !== 0) return null;
    const out = new TextDecoder().decode(r.stdout).trim();
    if (!out) return null;
    return out;
  } catch {
    return null;
  }
}

function aptHasRepo(name: string): boolean {
  try {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(escaped);
    // Main sources.list
    try {
      const r = Bun.spawnSync({ cmd: ["cat", "/etc/apt/sources.list"] });
      if (r.exitCode === 0) {
        const text = new TextDecoder().decode(r.stdout);
        if (rx.test(text)) return true;
      }
    } catch {}

    // Any .list file in sources.list.d
    try {
      const glob = new Bun.Glob("*.list");
      for (const rel of glob.scanSync({ cwd: "/etc/apt/sources.list.d" })) {
        try {
          const p = `/etc/apt/sources.list.d/${rel}`;
          const r = Bun.spawnSync({ cmd: ["cat", p] });
          if (r.exitCode !== 0) continue;
          const text = new TextDecoder().decode(r.stdout);
          if (rx.test(text)) return true;
        } catch {}
      }
    } catch {}
  } catch {}
  return false;
}

function aptHasKey(name: string): boolean {
  try {
    const r = Bun.spawnSync({ cmd: ["apt-key", "list"] });
    if (r.exitCode !== 0) return false;
    const out = new TextDecoder().decode(r.stdout);
    return new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(out);
  } catch {
    return false;
  }
}

class AptPlugin implements import("@dot-steward/types").Plugin {
  readonly id = "apt" as const;
  private readonly instance = Plugin
    .define("apt")
    .capability("apt.package", undefined, { provides: ["package"], description: "Manage APT packages" })
    .capability("apt.repo", undefined, { provides: ["apt.repo"], description: "Manage APT repositories" })
    .capability("apt.key", undefined, { provides: ["apt.key"], description: "Manage APT repo keys" })
  .ready(({ host }) => {
    const isDebianFamily = host.os === "linux" && /debian|ubuntu/i.test(host.distro ?? "");
    return isDebianFamily
      ? { status: "ready" }
      : {
          status: "not_ready",
          checks: [
            {
              name: "platform",
              ok: false,
              details: "Requires Debian/Ubuntu (APT) environment",
            },
          ],
        };
  })
  .supports((item, { host }) => {
    if (item.kind !== "package") return false;
    return host.os === "linux" && /debian|ubuntu/i.test(host.distro ?? "");
  })
  .on("apt.package", {
    probe: (item) => {
      const d = normalizeDesired(item.spec as Desired);
      if (!d) return {};
      return { installedVersion: hasApt() ? dpkgVersion(d.name) : null };
    },
    diff: (_current, desired) => {
      const d = normalizeDesired(desired as Desired);
      const okPlatform = hasApt();
      const installed = d && okPlatform ? dpkgVersion(d.name) : null;
      const changed = !installed || (d?.version && d.version !== installed);
      return {
        current: installed,
        desired: d ?? desired,
        idempotent: true,
        changes: changed
          ? [{ path: `apt.package:${d?.name ?? "unknown"}`, from: installed ?? undefined, to: d?.version ?? "present" }]
          : [],
      };
    },
  })
  .on("apt.repo", {
    diff: (_current, desired) => {
      const d = normalizeDesired(desired as Desired);
      const name = d?.name ?? String(desired ?? "");
      const present = hasApt() ? aptHasRepo(name) : false;
      return {
        current: present ? "present" : null,
        desired: { name },
        idempotent: true,
        changes: present ? [] : [{ path: `apt.repo:${name}`, from: undefined, to: "present" }],
      };
    },
  })
  .on("apt.key", {
    diff: (_current, desired) => {
      const d = normalizeDesired(desired as Desired);
      const name = d?.name ?? String(desired ?? "");
      const present = hasApt() ? aptHasKey(name) : false;
      return {
        current: present ? "present" : null,
        desired: { name },
        idempotent: true,
        changes: present ? [] : [{ path: `apt.key:${name}`, from: undefined, to: "present" }],
      };
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

  // Item helpers
  package(spec: Desired): ManagedItem<Desired> {
    const d = normalizeDesired(spec) ?? { name: String(spec) };
    return { id: `apt:${d.name}`, kind: "package", spec: d, owner: "apt" };
  }
  repo(name: string): ManagedItem<{ name: string }> {
    return { id: `apt.repo:${name}`, kind: "apt.repo", spec: { name }, owner: "apt" };
  }
  key(name: string): ManagedItem<{ name: string }> {
    return { id: `apt.key:${name}`, kind: "apt.key", spec: { name }, owner: "apt" };
  }
}

export function apt() {
  return new AptPlugin();
}

export default apt;
