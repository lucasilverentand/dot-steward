import { Plugin } from "@dot-steward/core";
import { AptItem, type Apt } from "./item";

export class AptPlugin extends Plugin<Apt> {
  name = "apt";
  schema = AptItem;
}

export const plugin = new AptPlugin();
