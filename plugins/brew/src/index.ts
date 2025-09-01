import { Base, Plugin, z } from "@dot-steward/core";

export const BrewTap = Base.extend({
  plugin: z.literal("brew"),
  kind: z.literal("tap"),
});
export const BrewFormula = Base.extend({
  plugin: z.literal("brew"),
  kind: z.literal("formula"),
});
export const BrewCask = Base.extend({
  plugin: z.literal("brew"),
  kind: z.literal("cask"),
});

export type Tap = z.infer<typeof BrewTap>;
export type Formula = z.infer<typeof BrewFormula>;
export type Cask = z.infer<typeof BrewCask>;

type TapInput = Omit<Tap, "plugin" | "kind">;
type FormulaInput = Omit<Formula, "plugin" | "kind">;
type CaskInput = Omit<Cask, "plugin" | "kind">;

export function tap(id: string): Tap;
export function tap(input: TapInput): Tap;
export function tap(idOrInput: string | TapInput): Tap {
  if (typeof idOrInput === "string") {
    return { plugin: "brew", kind: "tap", id: idOrInput };
  }
  return { plugin: "brew", kind: "tap", ...idOrInput };
}

export function formula(id: string): Formula;
export function formula(input: FormulaInput): Formula;
export function formula(idOrInput: string | FormulaInput): Formula {
  if (typeof idOrInput === "string") {
    return { plugin: "brew", kind: "formula", id: idOrInput };
  }
  return { plugin: "brew", kind: "formula", ...idOrInput };
}

export function cask(id: string): Cask;
export function cask(input: CaskInput): Cask;
export function cask(idOrInput: string | CaskInput): Cask {
  if (typeof idOrInput === "string") {
    return { plugin: "brew", kind: "cask", id: idOrInput };
  }
  return { plugin: "brew", kind: "cask", ...idOrInput };
}

export const BrewItem = z.discriminatedUnion("kind", [
  BrewTap,
  BrewFormula,
  BrewCask,
]);
export type BrewItem = z.infer<typeof BrewItem>;

export class BrewPlugin extends Plugin<BrewItem> {
  name = "brew";
  schema = BrewItem;
  async prepare(): Promise<void> {
    // no-op
  }
}

export const plugin = new BrewPlugin();
