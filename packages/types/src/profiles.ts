// Profiles and matching
export interface HostFacts {
  os:
    | "darwin"
    | "linux"
    | "windows"
    | "freebsd"
    | "openbsd"
    | "netbsd"
    | "aix"
    | "sunos";
  distro?: string; // e.g. ubuntu, debian, arch, nixos
  arch: "x64" | "arm64" | "arm" | "ppc64" | "s390x" | "ia32" | (string & {});
  user?: string;
  hostname?: string;
  env: Record<string, string | undefined>;
  container?: boolean;
  virtualization?:
    | "wsl"
    | "kvm"
    | "hyperv"
    | "vmware"
    | "virtualbox"
    | "parallels"
    | "containerd"
    | "docker"
    | "podman"
    | (string & {})
    | undefined;
}

export type Matcher = {
  // Composition
  all?: Matcher[];
  any?: Matcher[];
  not?: Matcher;
  // Predicates
  os?: HostFacts["os"] | HostFacts["os"][];
  distro?: string | string[];
  arch?: HostFacts["arch"] | HostFacts["arch"][];
  user?: string | string[];
  hostname?: string | string[];
  env?: Record<string, string | undefined>;
  container?: boolean;
  virtualization?:
    | HostFacts["virtualization"]
    | NonNullable<HostFacts["virtualization"]>[];
};

export type AppRef = string | { name: string; config?: unknown };
export type PluginRef = string | { id: string; config?: unknown };

import type { ManagedItem } from "./items";

export interface Profile {
  name: string;
  priority?: number;
  variables?: Record<string, string>;
  includes?: string[];
  apps?: AppRef[];
  plugins?: PluginRef[];
  items?: ManagedItem[];
  matcher?: Matcher;
}
