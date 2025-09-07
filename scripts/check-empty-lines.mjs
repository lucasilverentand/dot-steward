#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

async function* walk(dir) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const ROOT = process.cwd();
const TARGET = join(ROOT, "packages/cli/src");
const re = /(?:\r?\n)[ \t]*\r?\n[ \t]*(?:\r?\n)/; // two or more consecutive blank lines
const offenders = [];
for await (const p of walk(TARGET)) {
  if (!p.endsWith(".ts")) continue;
  const txt = await readFile(p, "utf8");
  if (re.test(txt)) offenders.push(p);
}

if (offenders.length > 0) {
  console.error("Found multiple consecutive empty lines in CLI sources:");
  for (const f of offenders) console.error("  -", f);
  process.exit(1);
}
