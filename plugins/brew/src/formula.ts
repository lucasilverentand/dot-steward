import type { Formula } from "./items";

type FormulaInput = Omit<Formula, "plugin" | "kind">;

export function formula(id: string): Formula;
export function formula(input: FormulaInput): Formula;
export function formula(idOrInput: string | FormulaInput): Formula {
  if (typeof idOrInput === "string") {
    return { plugin: "brew", kind: "formula", id: idOrInput };
  }
  return { plugin: "brew", kind: "formula", ...idOrInput };
}
