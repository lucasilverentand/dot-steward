# @dot-steward/plugin-git

Git plugin for managing repositories as managed items (clone/update) and possibly enforcing working-copy state. Exposes a fluent registration API.

## Capabilities (planned)
- `git.repo` — ensure a repository is present at a path with the desired remote, branch, and revision
- Optional: shallow clones, submodules, signatures verification

## Readiness
- Verifies `git` is available and at a compatible version

## Usage (planned, fluent)
```ts
import { Plugin } from "@dot-steward/types";

export default Plugin
  .define("git")
  .capability("git.repo", schemaRepo)
  .probe(probeGit)
  .diff(diffGit)
  .action(applyGit)
  .ready(checkGit)
  .build();
```
