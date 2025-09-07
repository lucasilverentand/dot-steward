#!/usr/bin/env bun
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const versionArg = process.argv[2];
if (!versionArg) {
  console.error("Usage: bun run scripts/bump-version.mjs <version>");
  process.exit(1);
}

const version = versionArg.replace(/^v/, "");

const workspaceDirs = [join(root, "packages"), join(root, "plugins")];

function isWorkspacePackageName(name) {
  return name?.startsWith("@dot-steward/");
}

async function updatePackageJson(pkgPath) {
  const txt = await readFile(pkgPath, "utf8");
  const json = JSON.parse(txt);

  // Set package version
  if (json.version) json.version = version;

  // Update internal dependency ranges to ^version
  for (const field of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    if (!json[field]) continue;
    for (const depName of Object.keys(json[field])) {
      if (isWorkspacePackageName(depName)) {
        json[field][depName] = `^${version}`;
      }
    }
  }

  const formatted = `${JSON.stringify(json, null, 2)}\n`;
  await writeFile(pkgPath, formatted);
}

async function* walkWorkspaces() {
  for (const base of workspaceDirs) {
    let entries = [];
    try {
      entries = await readdir(base, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      const pkgPath = join(base, ent.name, "package.json");
      yield pkgPath;
    }
  }
}

const updates = [];
for await (const pkgJson of walkWorkspaces()) {
  updates.push(updatePackageJson(pkgJson));
}

await Promise.all(updates);
console.log(`Bumped workspace package versions to ${version}`);
