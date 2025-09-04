# dot-steward

Monorepo for a Bun-based dot file manager. This repo hosts the core library (including phases and execution engine), the CLI app, and a set of provider plugins described in `docs/design.md`.

## API Design
- Fluent, chainable builders across core and plugins
- Immutability by default; builders produce finalized artifacts via `.build()`/`.emit()`/`.run()`
- Clear separation of construction vs. execution

## Workspace
- Tooling: Bun workspaces + Biome formatter/linter
- Packages live under `packages/`, apps under `apps/`, plugins under `plugins/`
- Source-only layout: all modules export from `src/index.ts` (no dist step)

## Quick start
1. Install Bun: https://bun.sh
2. Install deps: `bun install`
3. Lint/format: `bun run lint` / `bun run format`

## Example
Define a config with profiles (all profiles and items apply; no selection):

```ts
import { config, profile } from "@dot-steward/core";

export const profiles = [
  profile({
    name: "base",
    priority: 0,
    variables: { EDITOR: "nvim" },
    items: [
      { id: "env:editor", kind: "env", spec: { name: "EDITOR", value: "nvim" } },
    ],
  }),
  profile({
    name: "packages",
    items: [
      { id: "pkg:git-brew", kind: "package", spec: { provider: "brew", name: "git" } },
      { id: "pkg:git-apt", kind: "package", spec: { provider: "apt", name: "git" } },
    ],
  }),
];

export default config({ profiles });
```

Note: Profiles apply if their `match` evaluates true (or if `match` is omitted). Matched profiles are applied in order of appearance.
