import { Plugin } from "@dot-steward/core";
import { CommandItem, type Command } from "./item";

export class CommandPlugin extends Plugin<Command> {
  name = "command";
  schema = CommandItem;
}

export const plugin = new CommandPlugin();
