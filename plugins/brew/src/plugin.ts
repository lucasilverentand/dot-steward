import { Plugin } from "@dot-steward/core";
import { BrewItem } from "./items";

export class BrewPlugin extends Plugin<BrewItem> {
  name = "brew";
  schema = BrewItem;
  async prepare(): Promise<void> {
    // no-op
  }
}

export const plugin = new BrewPlugin();
