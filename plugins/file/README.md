# @dot-steward/plugin-file

File-system plugin providing managed items for files, directories, symlinks, and templated content. Exposes a fluent registration API.

## Capabilities (planned)
- `file` — ensure file content (from inline, template, or source path)
- `dir` — ensure directory exists with expected mode/owner
- `symlink` — ensure symbolic link points to target
- `template` — render with variables and checksums

## Readiness
- Verifies file-system access and required utilities (if any)

## Usage (planned, fluent)
Imported and orchestrated by core via a fluent `Plugin` builder:
```ts
import { Plugin } from "@dot-steward/types";

export default Plugin
  .define("file")
  .capability("file", schemaFile)
  .capability("dir", schemaDir)
  .capability("symlink", schemaSymlink)
  .probe(probeFn)
  .diff(diffFn)
  .action(actionFn)
  .ready(checkFs)
  .build();
```

The plugin defines schemas, probes, diffs, and idempotent actions.
