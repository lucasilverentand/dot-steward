import { Plugin } from "@dot-steward/core";
import type { Apt } from "./item";

export class AptPlugin extends Plugin<Apt> {
  name = "apt";
}

export const plugin = new AptPlugin();
