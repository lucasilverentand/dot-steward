import { BrewFormula } from "./formula.ts";
import { BrewCask } from "./cask.ts";
import { BrewTap } from "./tap.ts";

export const brew = {
  formula(name: string, opts?: { requires?: string[] }) {
    return new BrewFormula(name, opts);
  },
  cask(
    name: string,
    opts?: { flags?: string[]; requires?: string[] },
  ) {
    return new BrewCask(name, opts);
  },
  tap(tapName: string, opts?: { requires?: string[] }) {
    return new BrewTap(tapName, opts);
  },
};

