import { Command } from "commander";
// Read version from package.json so published CLI shows correct version
// Bun supports JSON imports in ESM
import pkg from "../package.json" assert { type: "json" };
import { registerApply } from "./commands/apply.ts";
import { registerHelp } from "./commands/help.ts";
import { registerPlan } from "./commands/plan.ts";

export function createProgram(): Command {
  const program = new Command();

  program
    .name("dot-steward")
    .description("Manage and steward your dotfiles with plugins")
    .version(pkg.version ?? "0.0.0");

  // Register commands
  registerHelp(program);
  registerPlan(program);
  registerApply(program);
  // Upgrade is handled as part of apply; no separate command

  // Future commands can be registered here with program.command(...)

  return program;
}

export type { Command } from "commander";
