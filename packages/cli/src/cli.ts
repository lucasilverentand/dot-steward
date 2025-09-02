#!/usr/bin/env bun
import { OS, detectHost, formatHostSummary } from "@dot-steward/core";

export function run(args: string[] = []): void {
  const os = OS.parse(process.platform);
  console.log(`dot-steward cli running on ${os}`);
  const host = detectHost();
  console.log(formatHostSummary(host));
  if (args.length > 0) {
    console.log(`arguments: ${args.join(" ")}`);
  }
}

if (import.meta.main) {
  run(process.argv.slice(2));
}
