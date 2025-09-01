import { Base, Plugin, z } from "@dot-steward/core";

export const CommandItem = Base.extend({
  plugin: z.literal("command"),
  kind: z.literal("cmd"),
  check: z.string().min(1),
  apply: z.string().min(1),
});

export type Command = z.infer<typeof CommandItem>;

type CmdInput = Omit<Command, "plugin" | "kind">;

export function cmd(id: string, check: string, apply: string): Command;
export function cmd(input: CmdInput): Command;
export function cmd(
  idOrInput: string | CmdInput,
  check?: string,
  apply?: string,
): Command {
  if (typeof idOrInput === "string") {
    if (!check || !apply) {
      throw new Error("check and apply are required");
    }
    return { plugin: "command", kind: "cmd", id: idOrInput, check, apply };
  }
  return { plugin: "command", kind: "cmd", ...idOrInput };
}

export class CommandPlugin extends Plugin<Command> {
  name = "command";
  schema = CommandItem;
}

export const plugin = new CommandPlugin();
