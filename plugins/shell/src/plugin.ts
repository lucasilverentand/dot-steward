import { Plugin } from "@dot-steward/core";
import { ShellItem } from "./items";

export class ShellPlugin extends Plugin<ShellItem> {
  name = "shell";
  schema = ShellItem;
}

export const plugin = new ShellPlugin();
