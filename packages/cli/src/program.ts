import { Command } from "commander";
import { registerAnalyze } from "./commands/analyze.ts";
import { registerHelp } from "./commands/help.ts";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("dot-steward")
    .description("Manage and steward your dotfiles with plugins")
    .version("0.0.0");

  // Register commands
  registerHelp(program);
  registerAnalyze(program);

  // Future commands can be registered here with program.command(...)

  return program;
}

export type { Command } from "commander";
