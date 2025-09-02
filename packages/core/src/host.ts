import os from "node:os";
import fs from "node:fs";
import { execSync } from "node:child_process";
import crypto from "node:crypto";

// Collocated platform enums (no external deps)
export const OS_OPTIONS = ["darwin", "linux", "win32"] as const;
export type OS = (typeof OS_OPTIONS)[number];
export const OS = {
  options: OS_OPTIONS,
  parse(input: string): OS {
    if (OS_OPTIONS.includes(input as OS)) return input as OS;
    throw new Error(`invalid OS: ${input}`);
  },
} as const;

export const ARCH_OPTIONS = [
  "x64",
  "arm64",
  "arm",
  "ia32",
  "ppc",
  "ppc64",
  "s390",
  "s390x",
  "mips",
  "mipsel",
  "riscv64",
  "loong64",
] as const;
export type Arch = (typeof ARCH_OPTIONS)[number];
export const Arch = {
  options: ARCH_OPTIONS,
  parse(input: string): Arch {
    if (ARCH_OPTIONS.includes(input as Arch)) return input as Arch;
    throw new Error(`invalid Arch: ${input}`);
  },
} as const;

export interface HostContext {
  os: OS;
  arch: Arch;
  release: string;
  hostname: string;
  username: string;
  homeDir: string;
  shell?: string;
  cpus: number;
  totalMem: number;
  machineId?: string;
  fingerprint: string;
  isCI: boolean;
  isWSL: boolean;
  inContainer: boolean;
  env: Record<string, string | undefined>;
}

function readText(file: string): string | undefined {
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    return undefined;
  }
}

function exists(file: string): boolean {
  try {
    fs.accessSync(file, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

function detectMachineIdDarwin(): string | undefined {
  try {
    const out = execSync("ioreg -rd1 -c IOPlatformExpertDevice", {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    });
    const match = out.match(/\bIOPlatformUUID" = "([^"]+)"/);
    if (match) return match[1];
  } catch {
    // ignore
  }
  // Fallback: hostid (not globally unique, but stable-ish)
  try {
    const out = execSync("hostid", {
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    });
    const id = out.trim();
    if (id) return `hostid:${id}`;
  } catch {
    // ignore
  }
  return undefined;
}

function detectMachineIdLinux(): string | undefined {
  return (
    readText("/etc/machine-id") ??
    readText("/var/lib/dbus/machine-id") ??
    undefined
  );
}

function detectMachineIdWin32(): string | undefined {
  try {
    const out = execSync(
      "reg query HKLM\\\\SOFTWARE\\\\Microsoft\\\\Cryptography /v MachineGuid",
      { stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" },
    );
    const parts = out.split(/\r?\n/).find((l) => l.includes("MachineGuid"));
    if (parts) {
      const m = parts.trim().split(/\s{2,}/);
      const maybe = m[m.length - 1];
      if (maybe) return maybe.trim();
    }
  } catch {
    // ignore
  }
  return undefined;
}

function detectMachineId(osName: OS): string | undefined {
  if (osName === "darwin") return detectMachineIdDarwin();
  if (osName === "linux") return detectMachineIdLinux();
  if (osName === "win32") return detectMachineIdWin32();
  return undefined;
}

function detectWSL(
  currentOS: OS,
  release: string,
  env: Record<string, string | undefined>,
): boolean {
  if (currentOS !== "linux") return false;
  if ((env.WSL_INTEROP && env.WSL_INTEROP.length > 0) || env.WSL_DISTRO_NAME) {
    return true;
  }
  return /microsoft/i.test(release);
}

function detectContainer(): boolean {
  // Linux heuristics
  if (process.platform !== "linux") return false;
  if (exists("/.dockerenv")) return true;
  const cgroup = readText("/proc/1/cgroup") ?? "";
  if (/docker|kubepods|containerd|lxc/i.test(cgroup)) return true;
  // systemd container
  const unit = readText("/proc/1/sched") ?? "";
  return /systemd/.test(unit) && /docker|podman/i.test(cgroup);
}

function isCIEnv(env: Record<string, string | undefined>): boolean {
  if (env.CI === "true" || env.CI === "1") return true;
  const keys = [
    "GITHUB_ACTIONS",
    "GITLAB_CI",
    "CIRCLECI",
    "APPVEYOR",
    "BUILDKITE",
    "DRONE",
    "TEAMCITY_VERSION",
    "CI_NAME",
  ];
  return keys.some((k) => Boolean(env[k]));
}

export function computeFingerprint(parts: Array<string | undefined>): string {
  const data = parts.filter(Boolean).join("|:");
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function detectHost(): HostContext {
  const platform = process.platform;
  const osName = OS.parse(platform);
  const release = os.release();
  const hostname = os.hostname();
  const user = (() => {
    try {
      return os.userInfo().username;
    } catch {
      return process.env.USER || process.env.USERNAME || "unknown";
    }
  })();
  const homeDir = os.homedir();
  const shell = process.env.SHELL || process.env.ComSpec;
  const cpus = os.cpus()?.length ?? 1;
  const totalMem = os.totalmem();
  const machineId = detectMachineId(osName);
  const isWSL = detectWSL(osName, release, process.env);
  const inContainer = detectContainer();
  const isCI = isCIEnv(process.env);
  const arch = Arch.parse(process.arch);

  const fingerprint = computeFingerprint([
    machineId,
    hostname,
    osName,
    arch,
    release,
    user,
    homeDir,
  ]);

  return {
    os: osName,
    arch,
    release,
    hostname,
    username: user,
    homeDir,
    shell: shell ?? undefined,
    cpus,
    totalMem,
    machineId,
    fingerprint,
    isCI,
    isWSL,
    inContainer,
    env: { ...process.env },
  };
}

export function formatHostSummary(host: HostContext): string {
  const memGB = (host.totalMem / 1024 ** 3).toFixed(1);
  const flags = [
    host.isCI ? "CI" : undefined,
    host.isWSL ? "WSL" : undefined,
    host.inContainer ? "container" : undefined,
  ]
    .filter(Boolean)
    .join(", ");
  const flagStr = flags ? ` [${flags}]` : "";
  const idStr = host.machineId ? host.machineId : "unknown";
  return (
    `host ${host.hostname} (${host.os}/${host.arch}, ${host.cpus} cores, ${memGB}GB)\n` +
    `user ${host.username} shell=${host.shell ?? "n/a"}\n` +
    `machine-id ${idStr}${flagStr}\n` +
    `fingerprint ${host.fingerprint.slice(0, 12)}…`
  );
}

export function hostEnv(): Record<string, string | undefined> {
  return { ...process.env };
}
