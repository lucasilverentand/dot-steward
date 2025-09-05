import { BrewFormula } from "./formula.ts";
import { BrewTap } from "./tap.ts";

export const brew = {
  formula(name: string, opts?: { tap?: BrewTap }) {
    return new BrewFormula(name, opts);
  },
  cask(name: string, opts?: { flags?: string[]; tap?: BrewTap }) {
    return new BrewFormula(name, {
      tap: opts?.tap,
      kind: "cask",
      flags: opts?.flags,
    });
  },
  tap(tapName: string) {
    return new BrewTap(tapName);
  },
};
