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

## Publish & Use in Other Repos

- Packages published:
  - `@dot-steward/core`
  - `@dot-steward/cli`
  - `@dot-steward/plugin-brew`, `@dot-steward/plugin-file`, `@dot-steward/plugin-exec`, `@dot-steward/plugin-mise`, `@dot-steward/plugin-shell-config`, `@dot-steward/plugin-app-store`, `@dot-steward/plugin-ghostty`

- Prepare/publish (one-time per release):
  - Set versions in each package and ensure inter-package deps point to the tagged version (already configured as `^0.1.0`).
  - Publish in order (root): `bun run release:publish`.

- Install in a consumer repo:
  - Ensure Bun is installed.
  - Add deps: `bun add -D @dot-steward/cli` and add plugins you use, e.g. `bun add @dot-steward/core @dot-steward/plugin-brew @dot-steward/plugin-file @dot-steward/plugin-exec @dot-steward/plugin-mise @dot-steward/plugin-shell-config`.
  - Create a `config.ts` that imports from the published packages, e.g.:

    ```ts
    import { config, profile, os } from "@dot-steward/core";
    import { brew } from "@dot-steward/plugin-brew";
    import { file } from "@dot-steward/plugin-file";
    import { exec } from "@dot-steward/plugin-exec";
    import { shell_config } from "@dot-steward/plugin-shell-config";
    // ... others as needed

    const mac = profile({ name: "mac", matches: os("darwin"), items: [
      brew.formula("git"),
      file.from("./hello.txt", ".config/dot-steward/hello.txt"),
      shell_config.rc.build(),
    ]});

    export default config(mac);
    ```

- Run the CLI in the consumer repo:
  - Using bunx: `bunx -p @dot-steward/cli dot-steward plan -c ./config.ts`
  - Or after adding as devDependency: `bunx dot-steward plan -c ./config.ts`

Notes:
- The CLI uses a Bun shebang and runs TypeScript directly; Bun is required at runtime.
- Example config in `examples/config.ts` uses local workspace imports; in external repos, import from the published `@dot-steward/*` packages as shown above.

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

export default config(profiles);
```

Note: Profiles apply if their `match` evaluates true (or if `match` is omitted). Matched profiles are applied in order of appearance.

## Inputs with Zod (advanced)
Profiles can declare inputs using a Zod schema. Defaults live in the schema; the `items` builder receives a typed `input` object.

```ts
import { config, profile, os } from "@dot-steward/core";
import { z } from "zod";

const mac = profile({
  name: "mac",
  matches: os("darwin"),
  inputs: z.object({
    browser: z.enum(["chrome", "firefox"]).default("chrome"),
    devtools: z.boolean().default(true),
  }),
  items: ({ input, when }) => [
    ...when(input.browser === "chrome", /* ... */),
    ...when(input.browser === "firefox", /* ... */),
    ...when(input.devtools, /* dev tools items */),
  ],
});

export default config(mac);
```
