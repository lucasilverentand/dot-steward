import { CopyFile, FileContent, type FileOptions, deepMerge } from "./file.ts";
import type { FilePlugin } from "./plugin.ts";

export const file = {
  // Compose multiple object parts with deep-merge (arrays replace)
  compose<T extends Array<Record<string, unknown>>>(
    ...parts: T
  ): Record<string, unknown> {
    return deepMerge({}, ...parts);
  },

  // Structured formats
  json(
    path: string,
    data: unknown,
    opts?: FileOptions & { plugin?: FilePlugin },
  ) {
    return new FileContent(path, "json", data, opts, opts?.plugin);
  },
  yaml(
    path: string,
    data: unknown,
    opts?: FileOptions & { plugin?: FilePlugin },
  ) {
    return new FileContent(path, "yaml", data, opts, opts?.plugin);
  },
  toml(
    path: string,
    data: unknown,
    opts?: FileOptions & { plugin?: FilePlugin },
  ) {
    return new FileContent(path, "toml", data, opts, opts?.plugin);
  },

  // Raw text (string or string[])
  raw(
    path: string,
    text: string | string[],
    opts?: FileOptions & { plugin?: FilePlugin },
  ) {
    return new FileContent(path, "raw", text, opts, opts?.plugin);
  },

  // Copy verbatim from source to destination
  from(
    src: string,
    dest: string,
    opts?: { mode?: number; plugin?: FilePlugin },
  ) {
    return new CopyFile(src, dest, opts?.mode, opts?.plugin);
  },
};

export type { FileOptions } from "./file.ts";
export { FilePlugin } from "./plugin.ts";
