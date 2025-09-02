import type { HostFacts } from "@dot-steward/types";

function mapPlatform(p: NodeJS.Platform): HostFacts["os"] {
  switch (p) {
    case "darwin":
      return "darwin";
    case "win32":
      return "windows";
    case "linux":
      return "linux";
    case "freebsd":
      return "freebsd";
    case "openbsd":
      return "openbsd";
    case "netbsd":
      return "netbsd";
    case "aix":
      return "aix";
    case "sunos":
      return "sunos";
    default:
      return "linux";
  }
}

function mapArch(a: string): HostFacts["arch"] {
  switch (a) {
    case "x64":
    case "arm64":
    case "arm":
    case "ppc64":
    case "s390x":
    case "ia32":
      return a;
    default:
      return a as HostFacts["arch"];
  }
}

function readFileTextSync(path: string): string | undefined {
  try {
    const r = Bun.spawnSync({ cmd: ["cat", path] });
    if (r.exitCode !== 0) return undefined;
    return new TextDecoder().decode(r.stdout);
  } catch {
    return undefined;
  }
}

function readOsRelease(): Record<string, string> | undefined {
  try {
    const text = readFileTextSync("/etc/os-release");
    if (!text) return undefined;
    const out: Record<string, string> = {};
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2];
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
    return out;
  } catch {
    return undefined;
  }
}

function detectLinuxDistro(): string | undefined {
  const data = readOsRelease();
  if (!data) return undefined;
  return data.ID || data.ID_LIKE || undefined;
}

function detectWSL(): boolean {
  try {
    if (process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP) return true;
    const ver = readFileTextSync("/proc/version");
    if (!ver) return false;
    return /Microsoft|WSL/i.test(ver);
  } catch {
    return false;
  }
}

function detectContainer(): {
  container?: boolean;
  virt?: HostFacts["virtualization"];
} {
  try {
    if (readFileTextSync("/.dockerenv") !== undefined)
      return { container: true, virt: "docker" };
    if (readFileTextSync("/run/.containerenv") !== undefined)
      return { container: true, virt: "podman" };
    const cg = readFileTextSync("/proc/1/cgroup");
    if (cg) {
      if (/docker/i.test(cg)) return { container: true, virt: "docker" };
      if (/containerd/i.test(cg))
        return { container: true, virt: "containerd" };
      if (/kubepods/i.test(cg)) return { container: true, virt: "docker" };
      if (/podman/i.test(cg)) return { container: true, virt: "podman" };
    }
    if (process.env.CONTAINER || process.env.container) {
      return { container: true };
    }
  } catch {
    // ignore
  }
  return {};
}

export function detectHostFacts(partial?: Partial<HostFacts>): HostFacts {
  const osName = mapPlatform(process.platform);
  const arch = mapArch(process.arch);
  const user = detectUser();
  const hostname = detectHostname();
  type BunLike = { env?: Record<string, string | undefined> };
  const bun = (globalThis as unknown as { Bun?: BunLike }).Bun;
  const env = (bun?.env ?? process.env) as Record<string, string | undefined>;

  let distro: string | undefined;
  let virtualization: HostFacts["virtualization"] | undefined;
  let container: boolean | undefined;

  if (osName === "linux") {
    distro = detectLinuxDistro();
    if (detectWSL()) virtualization = "wsl";
    const c = detectContainer();
    container = c.container ?? container;
    virtualization = c.virt ?? virtualization;
  }

  const detected: HostFacts = {
    os: osName,
    arch,
    env,
    distro,
    user,
    hostname,
    container,
    virtualization,
  };

  return {
    ...detected,
    ...(partial ?? {}),
    env: { ...detected.env, ...(partial?.env ?? {}) },
  };
}

export async function detectHostFactsAsync(
  partial?: Partial<HostFacts>,
): Promise<HostFacts> {
  type BunLike = { env?: Record<string, string | undefined> };
  const bun = (globalThis as unknown as { Bun?: BunLike }).Bun;
  const env = (bun?.env ?? process.env) as Record<string, string | undefined>;
  const osName = mapPlatform(process.platform);
  const arch = mapArch(process.arch);
  const user = env.USER || env.USERNAME || env.LOGNAME;
  const hostname = await detectHostnameAsync(env.HOSTNAME);

  let distro: string | undefined;
  let virtualization: HostFacts["virtualization"] | undefined;
  let container: boolean | undefined;

  if (osName === "linux") {
    distro = await detectLinuxDistroAsync();
    if (await detectWSLAsync()) virtualization = "wsl";
    const c = await detectContainerAsync();
    container = c.container ?? container;
    virtualization = c.virt ?? virtualization;
  }

  const detected: HostFacts = {
    os: osName,
    arch,
    env,
    distro,
    user,
    hostname,
    container,
    virtualization,
  };
  return {
    ...detected,
    ...(partial ?? {}),
    env: { ...detected.env, ...(partial?.env ?? {}) },
  };
}

async function fileTextIfExists(path: string): Promise<string | undefined> {
  type BunLike = {
    file?: (p: string) => {
      exists: () => Promise<boolean>;
      text: () => Promise<string>;
    };
  };
  const bun = (globalThis as unknown as { Bun?: BunLike }).Bun;
  const bunFile = bun?.file?.(path);
  if (bunFile) {
    const exists = await bunFile.exists();
    if (exists) return await bunFile.text();
    return undefined;
  }
  try {
    const r = Bun.spawnSync({ cmd: ["cat", path] });
    if (r.exitCode === 0) return new TextDecoder().decode(r.stdout);
  } catch {}
  return undefined;
}

async function detectLinuxDistroAsync(): Promise<string | undefined> {
  const text = await fileTextIfExists("/etc/os-release");
  if (!text) return undefined;
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    out[key] = val;
  }
  return out.ID || out.ID_LIKE || undefined;
}

async function detectWSLAsync(): Promise<boolean> {
  type BunLike = { env?: Record<string, string | undefined> };
  const bun = (globalThis as unknown as { Bun?: BunLike }).Bun;
  const env = bun?.env ?? process.env;
  if (env.WSL_DISTRO_NAME || env.WSL_INTEROP) return true;
  const ver = await fileTextIfExists("/proc/version");
  return ver ? /Microsoft|WSL/i.test(ver) : false;
}

async function detectContainerAsync(): Promise<{
  container?: boolean;
  virt?: HostFacts["virtualization"];
}> {
  if (await fileTextIfExists("/.dockerenv"))
    return { container: true, virt: "docker" };
  if (await fileTextIfExists("/run/.containerenv"))
    return { container: true, virt: "podman" };
  const cg = await fileTextIfExists("/proc/1/cgroup");
  if (cg) {
    if (/docker/i.test(cg)) return { container: true, virt: "docker" };
    if (/containerd/i.test(cg)) return { container: true, virt: "containerd" };
    if (/kubepods/i.test(cg)) return { container: true, virt: "docker" };
    if (/podman/i.test(cg)) return { container: true, virt: "podman" };
  }
  type BunLike = { env?: Record<string, string | undefined> };
  const bun = (globalThis as unknown as { Bun?: BunLike }).Bun;
  const env = bun?.env ?? process.env;
  if (env.CONTAINER || env.container) return { container: true };
  return {};
}

async function detectHostnameAsync(
  envHostname?: string,
): Promise<string | undefined> {
  if (envHostname) return envHostname;
  const etc = await fileTextIfExists("/etc/hostname");
  if (etc) return etc.trim();
  try {
    const r = Bun.spawnSync({ cmd: ["hostname"] });
    if (r.exitCode === 0)
      return new TextDecoder().decode(r.stdout).trim() || undefined;
  } catch {}
  return undefined;
}

function detectUser(): string | undefined {
  type BunLike = { env?: Record<string, string | undefined> };
  const bun = (globalThis as unknown as { Bun?: BunLike }).Bun;
  const env =
    (bun?.env ?? (process?.env as Record<string, string | undefined>)) || {};
  return env.USER || env.USERNAME || env.LOGNAME;
}

function detectHostname(): string | undefined {
  type BunLike = { env?: Record<string, string | undefined> };
  const bun = (globalThis as unknown as { Bun?: BunLike }).Bun;
  const env =
    (bun?.env ?? (process?.env as Record<string, string | undefined>)) || {};
  if (env.HOSTNAME) return env.HOSTNAME;
  try {
    const text = readFileTextSync("/etc/hostname")?.trim();
    if (text) return text;
  } catch {}
  try {
    const r = Bun.spawnSync({ cmd: ["hostname"] });
    if (r.exitCode === 0)
      return new TextDecoder().decode(r.stdout).trim() || undefined;
  } catch {}
  return undefined;
}
