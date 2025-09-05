import { Manager } from "@dot-steward/core";
import type { Command } from "commander";
import resolveConfigToFileUrl from "../utils/config.ts";

export function registerUpgrade(program: Command): void {
  program
    .command("upgrade")
    .description(
      "Check and upgrade installed items where updates are available",
    )
    .option(
      "-c, --config <path>",
      "Path to config file (TS/JS)",
      "dot-steward.config.ts",
    )
    .action(async (opts: { config: string }) => {
      const mgr = new Manager();
      const cfgUrl = resolveConfigToFileUrl(opts.config);
      try {
        await mgr.init(cfgUrl);
      } catch (err) {
        console.error(
          `Failed to load config from ${opts.config}. Try --config examples/config.ts`,
        );
        if (err instanceof Error) console.error(err.message);
        process.exitCode = 1;
        return;
      }

      // Simple progress reporter
      const GREEN = "\x1b[32m";
      const YELLOW = "\x1b[33m";
      const RED = "\x1b[31m";
      const DIM = "\x1b[2m";
      const RESET = "\x1b[0m";

      const line = (s: string) => process.stdout.write(`${s}\n`);
      mgr.events.on("item:upgrade_start", (p) => {
        const title = p.name ? `${p.kind} ${p.name}` : p.kind;
        line(`${YELLOW}… checking ${title}${RESET}`);
      });
      mgr.events.on("item:upgrade_skip", (p) => {
        const title = p.name ? `${p.kind} ${p.name}` : p.kind;
        line(`${DIM}→ ${title}${p.reason ? ` (${p.reason})` : ""}${RESET}`);
      });
      mgr.events.on("item:upgrade_done", (p) => {
        const title = p.name ? `${p.kind} ${p.name}` : p.kind;
        line(`${GREEN}✓ upgraded ${title}${RESET}`);
      });
      mgr.events.on("item:upgrade_error", (p) => {
        const title = p.name ? `${p.kind} ${p.name}` : p.kind;
        line(
          `${RED}✗ upgrade failed ${title}${p.error ? ` -> ${p.error}` : ""}${RESET}`,
        );
      });

      try {
        await mgr.upgrade();
      } catch (err) {
        console.error("Upgrade finished with errors.");
        if (err instanceof Error) console.error(err.message);
        process.exitCode = 1;
        return;
      }
    });
}

export type { Command } from "commander";
