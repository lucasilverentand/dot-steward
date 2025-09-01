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
- Biome configuration lives in `biome.json`; adhere to its rules.

## Verification

Before committing changes, make sure the following commands succeed:

```
bun run lint
bun run test
```

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. Each commit message begins with a type such as `feat`, `fix`, or `docs` and may include an optional scope. Use the imperative mood for the description.

Example:

```text
docs: add commit message guidelines
```

