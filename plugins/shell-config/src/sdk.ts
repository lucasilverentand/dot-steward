import { ShellProfile, type ShellProfileConfig } from "./profile.ts";
import { rc } from "./rc.ts";

export const shell_config = {
  profile(cfg: ShellProfileConfig) {
    return new ShellProfile(cfg);
  },
  rc: {
    add: rc.add,
    paths: rc.paths,
    aliases: rc.aliases,
    exports: rc.exports,
    lines: rc.lines,
    rcFiles: rc.rcFiles,
    build: rc.build,
    reset: rc.reset,
  },
};

export type { ShellProfileConfig } from "./profile.ts";

