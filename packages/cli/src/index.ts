#!/usr/bin/env bun

import { Command } from "commander";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

export function main(argv = process.argv): void {
  const program = new Command();

  program
    .name("stew")
    .description("Dot Steward CLI")
    .version(pkg.version);

  program
    .command("help")
    .description("Display help information")
    .action(() => {
      program.outputHelp();
    });

  program.parse(argv);
}

if (import.meta.main) {
  main();
}
