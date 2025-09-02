# Agent Guidelines

This repository uses [Bun](https://bun.sh) as its package manager and script
runner and [Biome](https://biomejs.dev) for code quality.

## Bun

- Install dependencies using `bun install`. Do not use other package managers.
- Add or remove packages with `bun add` or `bun remove` and commit the
  updated `bun.lock`.
- Run project scripts with `bun run <script>`.

## Biome

- Lint the codebase with `bun run lint`.
- Automatically fix lint issues with `bun run lint:fix`.
- Format files with `bun run format`.
- Always run `bun run lint:fix` and `bun run format` before committing and
  commit any changes they produce.
- The Biome workflow runs `bun run lint:fix` and `bun run format` and automatically
  commits any resulting changes using the
  [`lucasilverentand/auto-commit`](https://github.com/lucasilverentand/auto-commit) action.
- Biome configuration lives in `biome.json`; adhere to its rules.
- Tests run on pull requests via `.github/workflows/test.yml`, which executes
  `bun run lint` and `bun run test`.

## Verification

Run the fixer and formatter, then verify:

```
bun run lint:fix
bun run format
bun run lint
bun run test
```
All four commands must pass, and any modifications from the fixer or
formatter must be committed.

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. Each commit message begins with a type such as `feat`, `fix`, or `docs` and may include an optional scope. Use the imperative mood for the description.

Example:

```text
docs: add commit message guidelines
```

## Modules

- `index.ts` files act only as barrel files that re-export from sibling modules.
- Keep implementation code in small, focused files rather than `index.ts`.

## Repository Knowledge

- Whenever a change affects how we think about the code or repository, update this `AGENTS.md` to reflect the new understanding.
- The CLI lives in `packages/cli` and exposes `stew` and `dot-steward` binaries via the `bin` field.
- Matchers live in `packages/matchers` and export `darwin`, `linux`, and `any`/`match_any` to compose profile conditions.
- Core provides a simple id generator at `packages/core/src/id.ts` (`generateId(prefix?: string | {prefix?: string, length?: number})`). Zod has been removed; plugins and items rely on TypeScript types and lightweight helpers instead of runtime schemas.
- Local usage without publishing:
  - After `bun install`, the root postinstall runs `bun -C packages/cli link`, creating a global `stew` and `dot-steward` in `~/.bun/bin`.
  - Ensure `~/.bun/bin` is on `PATH` and run `stew` from anywhere.
  - Alternatively, run `bun run cli` at the repo root, or `bun run -C packages/cli dev`.
