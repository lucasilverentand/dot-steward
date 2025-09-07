import { Command } from "commander";
import { registerApply } from "./commands/apply.ts";
import { registerHelp } from "./commands/help.ts";
import { registerPlan } from "./commands/plan.ts";
import { registerUpgrade } from "./commands/upgrade.ts";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("dot-steward")
    .description("Manage and steward your dotfiles with plugins")
    .version("0.0.0");

  // Register commands
  registerHelp(program);
  registerPlan(program);
  registerApply(program);
  registerUpgrade(program);

  // Future commands can be registered here with program.command(...)

  return program;
}

export type { Command } from "commander";
