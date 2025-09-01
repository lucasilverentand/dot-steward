import { Base, z } from "@dot-steward/core";
import { cmd, type Command } from "@dot-steward/command";

export const BrewTap = Base.extend({
  module: z.literal("brew"),
  kind: z.literal("tap"),
});
export const BrewFormula = Base.extend({
  module: z.literal("brew"),
  kind: z.literal("formula"),
});
export const BrewCask = Base.extend({
  module: z.literal("brew"),
  kind: z.literal("cask"),
});

export type Tap = z.infer<typeof BrewTap>;
export type Formula = z.infer<typeof BrewFormula>;
export type Cask = z.infer<typeof BrewCask>;

type TapInput = Omit<Tap, "module" | "kind">;
type FormulaInput = Omit<Formula, "module" | "kind">;
type CaskInput = Omit<Cask, "module" | "kind">;

export function tap(id: string): Tap;
export function tap(input: TapInput): Tap;
export function tap(idOrInput: string | TapInput): Tap {
  if (typeof idOrInput === "string") {
    return { module: "brew", kind: "tap", id: idOrInput };
  }
  return { module: "brew", kind: "tap", ...idOrInput };
}

export function formula(id: string): Formula;
export function formula(input: FormulaInput): Formula;
export function formula(idOrInput: string | FormulaInput): Formula {
  if (typeof idOrInput === "string") {
    return { module: "brew", kind: "formula", id: idOrInput };
  }
  return { module: "brew", kind: "formula", ...idOrInput };
}

export function cask(id: string): Cask;
export function cask(input: CaskInput): Cask;
export function cask(idOrInput: string | CaskInput): Cask {
  if (typeof idOrInput === "string") {
    return { module: "brew", kind: "cask", id: idOrInput };
  }
  return { module: "brew", kind: "cask", ...idOrInput };
}

export function prepare(): Command[] {
  return [
    cmd(
      "brew-install",
      "command -v brew >/dev/null 2>&1",
      
      "/bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"",
    ),
    cmd(
      "brew-bundle-tap",
      "brew tap | grep -q '^homebrew/bundle$'",
      "brew tap homebrew/bundle",
    ),
  ];
}
