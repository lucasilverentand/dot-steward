import { ConfigFile, type ConfigFileOptions, deepMerge } from "./file.ts";
import { ConfigPlugin } from "./plugin.ts";

export const cfg = {
  // Compose multiple object parts with deep-merge (arrays replace)
  compose<T extends Array<Record<string, unknown>>>(...parts: T): Record<string, unknown> {
    return deepMerge({}, ...parts);
  },

  // Structured formats
  json(path: string, data: unknown, opts?: ConfigFileOptions & { plugin?: ConfigPlugin }) {
    return new ConfigFile(path, "json", data, opts, opts?.plugin);
  },
  yaml(path: string, data: unknown, opts?: ConfigFileOptions & { plugin?: ConfigPlugin }) {
    return new ConfigFile(path, "yaml", data, opts, opts?.plugin);
  },
  toml(path: string, data: unknown, opts?: ConfigFileOptions & { plugin?: ConfigPlugin }) {
    return new ConfigFile(path, "toml", data, opts, opts?.plugin);
  },

  // Raw text (string or string[])
  raw(path: string, text: string | string[], opts?: ConfigFileOptions & { plugin?: ConfigPlugin }) {
    return new ConfigFile(path, "raw", text, opts, opts?.plugin);
  },
};

export type { ConfigFileOptions } from "./file.ts";
export { ConfigPlugin } from "./plugin.ts";

