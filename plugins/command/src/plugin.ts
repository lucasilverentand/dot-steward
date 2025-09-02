import { Plugin } from "@dot-steward/core";
import type { Command } from "./item";

export class CommandPlugin extends Plugin<Command> {
  name = "command";
}

export const plugin = new CommandPlugin();
