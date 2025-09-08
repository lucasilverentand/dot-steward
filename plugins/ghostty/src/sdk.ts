import { file } from "../../file/src/index.ts";
import type { FileOptions } from "../../file/src/sdk.ts";
import { type GhosttyConfig, serializeConfig } from "./config.ts";
import { GhosttyInstall } from "./install.ts";
import type { GhosttyPlugin } from "./plugin.ts";

export const ghostty = {
  install(opts?: { plugin?: GhosttyPlugin }) {
    return new GhosttyInstall(opts?.plugin);
  },

  config(
    data: GhosttyConfig,
    opts?: (FileOptions & {
      plugin?: import("../../file/src/plugin.ts").FilePlugin;
    }) & { path?: string },
  ) {
    const p = opts?.path ?? ".config/ghostty/config";
    return file.raw(p, serializeConfig(data), opts);
  },
};

export type { GhosttyConfig } from "./config.ts";
