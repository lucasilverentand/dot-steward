import { Plugin } from "@dot-steward/core";
import type { ShellItem } from "./items";

export class ShellPlugin extends Plugin<ShellItem> {
  name = "shell";
}

export const plugin = new ShellPlugin();
