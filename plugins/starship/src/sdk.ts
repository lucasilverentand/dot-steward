import { file } from "../../file/src/index.ts";
import type { FileOptions } from "../../file/src/sdk.ts";
import { StarshipInit } from "./init.ts";
import type { StarshipPlugin } from "./plugin.ts";

export const starship = {
  // Contribute init lines to shell rc files (bash/zsh by default).
  init(opts?: { shells?: Array<"bash" | "zsh">; plugin?: StarshipPlugin }) {
    return new StarshipInit(opts?.plugin, { shells: opts?.shells });
  },

  // Manage ~/.config/starship.toml via file plugin convenience.
  toml(
    data: unknown,
    opts?: (FileOptions & { plugin?: import("../../file/src/plugin.ts").FilePlugin }) & { path?: string },
  ) {
    const p = opts?.path ?? ".config/starship.toml";
    return file.toml(p, data, opts);
  },
};

export type { FileOptions } from "../../file/src/sdk.ts";

