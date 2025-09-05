# @dot-steward/cli

Dot Steward command line interface powered by Commander.

## Usage

With Bun installed:

```
bun run packages/cli/src/cli.ts --help
bun run packages/cli/src/cli.ts help
```

After linking in the workspace, you can also run:

```
dot-steward --help
dot-steward help
```

## State

- Location: saves CLI state under `~/.dot-steward/`.
- Files: `last-plan.json`, `last-apply.json`.
- Override base dir with `DOT_STEWARD_HOME`.
