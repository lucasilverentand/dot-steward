import {
  ShellProfile,
  type ShellProfileConfig,
  type PathSpec,
  type ShellKindSimple,
} from "./profile.ts";

type Accum = Required<Pick<ShellProfileConfig, "universal" | "bash" | "zsh">> &
  Pick<ShellProfileConfig, "rcFiles">;
const acc: Accum = { universal: {}, bash: {}, zsh: {}, rcFiles: undefined };

function mergeRec<T extends Record<string, unknown> | undefined>(
  a: T,
  b: T,
): T {
  return { ...(a ?? {}), ...(b ?? {}) } as unknown as T;
}
function pushPaths(
  target: NonNullable<ShellProfileConfig["universal"]>,
  paths: PathSpec,
): void {
  const toNorm = (p?: PathSpec): { prepend: string[]; append: string[] } => {
    if (!p) return { prepend: [], append: [] };
    if (Array.isArray(p)) return { prepend: p, append: [] };
    return { prepend: p.prepend ?? [], append: p.append ?? [] };
  };
  const cur = toNorm(target.paths);
  const add = toNorm(paths);
  target.paths = {
    prepend: [...cur.prepend, ...add.prepend],
    append: [...cur.append, ...add.append],
  };
}

export const rc = {
  add(cfg: ShellProfileConfig): void {
    if (cfg.universal) {
      if (cfg.universal.paths) pushPaths(acc.universal, cfg.universal.paths);
      acc.universal.aliases = mergeRec(
        acc.universal.aliases,
        cfg.universal.aliases,
      );
      acc.universal.exports = mergeRec(
        acc.universal.exports,
        cfg.universal.exports,
      );
      acc.universal.lines = [
        ...(acc.universal.lines ?? []),
        ...(cfg.universal.lines ?? []),
      ];
    }
    if (cfg.bash) {
      if (cfg.bash.paths) pushPaths(acc.bash, cfg.bash.paths);
      acc.bash.aliases = mergeRec(acc.bash.aliases, cfg.bash.aliases);
      acc.bash.exports = mergeRec(acc.bash.exports, cfg.bash.exports);
      acc.bash.lines = [...(acc.bash.lines ?? []), ...(cfg.bash.lines ?? [])];
    }
    if (cfg.zsh) {
      if (cfg.zsh.paths) pushPaths(acc.zsh, cfg.zsh.paths);
      acc.zsh.aliases = mergeRec(acc.zsh.aliases, cfg.zsh.aliases);
      acc.zsh.exports = mergeRec(acc.zsh.exports, cfg.zsh.exports);
      acc.zsh.lines = [...(acc.zsh.lines ?? []), ...(cfg.zsh.lines ?? [])];
    }
    if (cfg.rcFiles) acc.rcFiles = { ...(acc.rcFiles ?? {}), ...cfg.rcFiles };
  },
  paths(
    paths: PathSpec,
    target: "universal" | ShellKindSimple = "universal",
  ): void {
    rc.add({ [target]: { paths } } as unknown as ShellProfileConfig);
  },
  aliases(
    aliases: Record<string, string>,
    target: "universal" | ShellKindSimple = "universal",
  ): void {
    rc.add({ [target]: { aliases } } as unknown as ShellProfileConfig);
  },
  exports(
    values: Record<string, string | number | boolean>,
    target: "universal" | ShellKindSimple = "universal",
  ): void {
    rc.add({ [target]: { exports: values } } as unknown as ShellProfileConfig);
  },
  lines(
    lines: string[],
    target: "universal" | ShellKindSimple = "universal",
  ): void {
    rc.add({ [target]: { lines } } as unknown as ShellProfileConfig);
  },
  rcFiles(files: Partial<Record<ShellKindSimple, string[]>>): void {
    rc.add({ rcFiles: files });
  },
  build(): ShellProfile {
    const merged: ShellProfileConfig = {
      universal: acc.universal,
      bash: acc.bash,
      zsh: acc.zsh,
      rcFiles: acc.rcFiles,
    };
    return new ShellProfile(merged);
  },
  reset(): void {
    acc.universal = {};
    acc.bash = {};
    acc.zsh = {};
    acc.rcFiles = undefined;
  },
};
