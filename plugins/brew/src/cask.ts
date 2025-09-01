import type { Cask } from "./items";

type CaskInput = Omit<Cask, "plugin" | "kind">;

export function cask(id: string): Cask;
export function cask(input: CaskInput): Cask;
export function cask(idOrInput: string | CaskInput): Cask {
  if (typeof idOrInput === "string") {
    return { plugin: "brew", kind: "cask", id: idOrInput };
  }
  return { plugin: "brew", kind: "cask", ...idOrInput };
}
