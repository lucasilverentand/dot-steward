import * as os from "node:os";
import { z } from "zod";
import type { HostMatchExpr } from "./matching.ts";

export const HostOSSchema = z.enum([
  "linux", // Linux
  "darwin", // macOS
  "win32", // Windows
  "unsupported", // Unsupported OS
]);

export const HostArchSchema = z.enum([
  "x86", // 32-bit Intel/AMD
  "x86_64", // 64-bit Intel/AMD (amd64)
  "arm", // 32-bit ARM
  "arm64", // 64-bit ARM (AArch64)
  "riscv64", // 64-bit RISC-V
  "ppc", // PowerPC 32-bit
  "ppc64", // PowerPC 64-bit
  "ppc64le", // PowerPC 64-bit Little Endian
  "s390x", // IBM mainframe
  "mips", // MIPS
  "unsupported",
]);

export const HostUserSchema = z.object({
  name: z.string().nonempty().nullable(),
  uid: z.string().nonempty().nullable(),
  gid: z.string().nonempty().nullable(),
  home: z.string().nonempty().nullable(),
  can_sudo: z.boolean().default(false),
  is_root: z.boolean().default(false),
});

export const HostEnvSchema = z.object({
  variables: z.record(z.string(), z.string()).default({}),
  ci: z.boolean().default(false),
  devcontainer: z.boolean().default(false),
});

export const HostContextSchema = z.object({
  os: HostOSSchema.nullable().default("unsupported"),
  arch: HostArchSchema.nullable().default("unsupported"),
  env: HostEnvSchema.default({ variables: {}, ci: false, devcontainer: false }),
  user: HostUserSchema.default({
    name: null,
    uid: null,
    home: null,
    gid: null,
    can_sudo: false,
    is_root: false,
  }),
});

type HostContextShape = z.infer<typeof HostContextSchema>;

export type HostOS = z.infer<typeof HostOSSchema>;
export type HostArch = z.infer<typeof HostArchSchema>;
export type HostEnv = z.infer<typeof HostEnvSchema>;
export type HostUser = z.infer<typeof HostUserSchema>;

export class HostContext implements HostContextShape {
  os: HostOS | null;
  arch: HostArch | null;
  env: HostEnv;
  user: HostUser;

  constructor() {
    const defaults = HostContextSchema.parse({});
    this.os = defaults.os;
    this.arch = defaults.arch;
    this.env = defaults.env;
    this.user = defaults.user;
  }

  async init(): Promise<this> {
    this.os = await this.detectOS();
    this.arch = await this.detectArch();
    this.env = await this.detectEnv();
    this.user = await this.detectUser();
    return this;
  }

  // Evaluate a HostMatch expression against this context
  evaluateMatch(expr: HostMatchExpr): boolean {
    const toRegExp = (pattern: string, flags?: string): RegExp | null => {
      try {
        return new RegExp(pattern, flags);
      } catch {
        return null;
      }
    };

    const evalExpr = (e: HostMatchExpr): boolean => {
      switch (e.type) {
        case "all":
          return e.of.every((sub) => evalExpr(sub));
        case "any":
          return e.of.some((sub) => evalExpr(sub));
        case "os":
          return this.os !== null && e.values.includes(this.os);
        case "arch":
          return this.arch !== null && e.values.includes(this.arch);
        case "hostname": {
          const actual = os.hostname();
          const v = e.value as unknown;
          if (typeof v === "string") return actual === v;
          const re = toRegExp(
            (v as { matches: string; flags?: string }).matches,
            (v as { matches: string; flags?: string }).flags,
          );
          return !!re && re.test(actual);
        }
        case "eq": {
          const k = e.key;
          const v = e.value as unknown;
          if (k === "env.ci") return this.env.ci === v;
          if (k === "env.devcontainer") return this.env.devcontainer === v;
          if (k === "user.can_sudo") return this.user.can_sudo === v;
          if (k === "user.is_root") return this.user.is_root === v;
          const matchStr = (actual: string | null) => {
            if (actual === null) return false;
            if (typeof v === "string") return actual === v;
            if (typeof v === "object" && v && "matches" in v) {
              const re = toRegExp(
                (v as { matches: string; flags?: string }).matches,
                (v as { matches: string; flags?: string }).flags,
              );
              return !!re && re.test(actual);
            }
            return false;
          };
          if (k === "user.name") return matchStr(this.user.name);
          if (k === "user.uid") return matchStr(this.user.uid);
          if (k === "user.gid") return matchStr(this.user.gid);
          if (k === "user.home") return matchStr(this.user.home);
          return false;
        }
        case "env-var": {
          const val = this.env.variables[e.name];
          if (e.value === undefined) return val !== undefined;
          if (typeof e.value === "string") return val === e.value;
          if (typeof val !== "string") return false;
          const re = toRegExp(e.value.matches, e.value.flags);
          return !!re && re.test(val);
        }
      }
    };

    return evalExpr(expr);
  }

  private async detectOS(): Promise<HostOS> {
    try {
      switch (process.platform) {
        case "linux":
          return "linux";
        case "darwin":
          return "darwin";
        case "win32":
          return "win32";
        default:
          return "unsupported";
      }
    } catch {
      return "unsupported";
    }
  }

  private async detectArch(): Promise<HostArch> {
    try {
      switch (process.arch) {
        case "x64":
          return "x86_64";
        case "ia32":
          return "x86";
        case "arm":
          return "arm";
        case "arm64":
          return "arm64";
        case "ppc64":
          return "ppc64";
        case "riscv64":
          return "riscv64";
        case "s390x":
          return "s390x";
        case "mips":
        case "mipsel":
          return "mips";
        default:
          return "unsupported";
      }
    } catch {
      return "unsupported";
    }
  }

  private async detectEnv(): Promise<HostEnv> {
    const variables: Record<string, string> = {};
    for (const [key, val] of Object.entries(process.env)) {
      if (typeof val === "string") variables[key] = val;
    }

    const truthy = (v: string | undefined) =>
      v !== undefined && /^(1|true|yes|y)$/i.test(v);

    const ci =
      truthy(process.env.CI) ||
      truthy(process.env.GITHUB_ACTIONS) ||
      truthy(process.env.GITLAB_CI) ||
      truthy(process.env.BUILDKITE) ||
      truthy(process.env.CIRCLECI) ||
      truthy(process.env.TRAVIS) ||
      truthy(process.env.APPVEYOR) ||
      truthy(process.env.TEAMCITY_VERSION) ||
      truthy(process.env.TF_BUILD) ||
      truthy(process.env.CODEBUILD_BUILD_ID) ||
      truthy(process.env.BITBUCKET_BUILD_NUMBER) ||
      truthy(process.env.JENKINS_URL) ||
      false;

    const devcontainer =
      truthy(process.env.DEVCONTAINER) ||
      truthy(process.env.REMOTE_CONTAINERS) ||
      truthy(process.env.VSCODE_REMOTE_CONTAINERS) ||
      truthy(process.env.VSCODE_REMOTE_CONTAINER) ||
      truthy(process.env.CODESPACES) ||
      truthy(process.env.GITPOD_WORKSPACE_ID) ||
      false;

    return HostEnvSchema.parse({ variables, ci, devcontainer });
  }

  private async detectUser(): Promise<HostUser> {
    try {
      const info = os.userInfo();
      const isRoot =
        typeof process.getuid === "function" && process.getuid() === 0;

      const name =
        typeof info.username === "string" && info.username.length > 0
          ? info.username
          : null;
      const uid =
        Number.isInteger(info.uid) && info.uid >= 0 ? String(info.uid) : null;
      const gid =
        Number.isInteger(info.gid) && info.gid >= 0 ? String(info.gid) : null;
      const homeCandidate =
        typeof info.homedir === "string" && info.homedir.length > 0
          ? info.homedir
          : os.homedir();
      const home =
        typeof homeCandidate === "string" && homeCandidate.length > 0
          ? homeCandidate
          : null;

      const user: HostUser = {
        name,
        uid,
        gid,
        home,
        can_sudo: isRoot,
        is_root: isRoot,
      };

      return HostUserSchema.parse(user);
    } catch {
      return HostUserSchema.parse({
        name: null,
        uid: null,
        gid: null,
        home: os.homedir() || null,
        can_sudo: false,
        is_root: false,
      });
    }
  }
}
