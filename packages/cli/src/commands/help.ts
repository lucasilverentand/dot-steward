import type { Command } from "commander";

export function registerHelp(program: Command): void {
  program
    .command("help [command]")
    .description("Display help for dot-steward or a specific command")
    .action((cmd?: string) => {
      if (!cmd) {
        program.outputHelp();
        return;
      }
      const target = program.commands.find(
        (c) => c.name() === cmd || c.aliases().includes(cmd),
      );
      if (target) {
        target.outputHelp();
      } else {
        console.error(`Unknown command: ${cmd}`);
        program.outputHelp();
        process.exitCode = 1;
      }
    });
}
