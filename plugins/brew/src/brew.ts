import { cask } from "./cask";
import { formula } from "./formula";

export type BrewKind = "formula" | "cask";

export interface BrewOptions {
  kind?: BrewKind;
}

export function brew(id: string, options: BrewOptions = {}) {
  const kind = options.kind ?? "formula";
  return kind === "cask" ? cask(id) : formula(id);
}
