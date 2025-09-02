import { Plugin } from "@dot-steward/core";
import type { BrewItem } from "./items";

export class BrewPlugin extends Plugin<BrewItem> {
  name = "brew";
  async prepare(): Promise<void> {
    // no-op
  }
}

export const plugin = new BrewPlugin();
