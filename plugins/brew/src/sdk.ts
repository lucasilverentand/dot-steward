import { BrewFormula } from "./formula.ts";
import { BrewTap } from "./tap.ts";

export const brew = {
  formula(name: string, opts?: { tap?: BrewTap }) {
    return new BrewFormula(name, opts);
  },
  tap(tapName: string) {
    return new BrewTap(tapName);
  },
};
