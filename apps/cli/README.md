# @dot-steward/cli

Command-line interface for the dot-steward manager. Implements the user-facing commands from `docs/design.md`. Internally, the CLI composes `@dot-steward/core`'s fluent APIs.

## Commands
- `analyze` — validate config, resolve profiles, detect conflicts (pretty or `--json`)
- `plan` — build deterministic plan, show change summary (pretty or `--json`), write with `-o`
- `apply` — execute a plan from `--plan` or from `--config` directly

## Usage
Run with Bun during development:
```
bun apps/cli/src/index.ts analyze -c examples/config.ts
bun apps/cli/src/index.ts plan -c examples/config.ts -o plan.json
bun apps/cli/src/index.ts apply -c examples/config.ts

# Or apply a saved plan
bun apps/cli/src/index.ts apply -p plan.json
```

Flags
- `-c, --config <path>`: path to a TS/JS config that default-exports the `ManagerConfig`
- `-o, --out <file>`: write plan JSON when planning
- `-p, --plan <file>`: apply from a previously saved plan
- `--json`: print raw JSON output instead of the UI

The CLI auto-loads plugins registered in the config (`plugins: [...]`).
