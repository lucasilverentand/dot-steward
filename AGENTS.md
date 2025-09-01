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
  commit any changes they produce. CI fails if these commands would modify
  files.
- Biome configuration lives in `biome.json`; adhere to its rules.

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