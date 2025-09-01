import type { Command } from "./item";

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
