# Repository Guidelines

## Project Structure & Module Organization
- Monorepo managed with Bun workspaces. Packages live in `packages/`, provider plugins in `plugins/`, docs in `docs/`, examples in `examples/`, and misc utilities in `scripts/`.
- Source-only layout: each package exports from `src/index.ts` (no build step or `dist/`).
- Naming: plugins are published as `@dot-steward/plugin-<name>`; core libs as `@dot-steward/<name>`.

## Build, Test, and Development Commands
- Install deps (root): `bun install`
- Lint all packages: `bun run lint` (Biome + custom checks)
- Format all packages: `bun run format` (Biome)
- Run the CLI locally: `cd packages/cli && bun run dev` (or `bun run src/cli.ts`)
- Bump versions across workspace: `bun run scripts/bump-version.mjs v0.x.y`
- Publish all (respecting graph): `bun run release:publish` (Turbo + `bun publish` per package)

## Coding Style & Naming Conventions
- Language: TypeScript (ESM). Indentation via spaces (Biome defaults).
- Keep modules small under `src/`; re-export public API via `src/index.ts`.
- File names: prefer concise lowercase or lowerCamelCase (match existing in each package); avoid deep nesting.
- Follow fluent builders and immutability patterns (construct with builders, finalize via `.build()` / `.emit()` / `.run()`).
- Lint/format before pushing. The `scripts/check-empty-lines.mjs` enforces “no multiple consecutive blank lines” in `packages/cli/src`.

## Testing Guidelines
- No formal test suite yet. Validate changes using the example config and CLI output:
  - Plan: `bunx -p @dot-steward/cli dot-steward plan -c examples/config.ts`
  - Apply (in a sandboxed test dir): `bunx -p @dot-steward/cli dot-steward apply -c examples/config.ts`
- If adding tests, prefer Bun’s built-in test runner in package-local `src/__tests__` and keep them fast and deterministic.

## Architecture Overview
- Phases: Analyze (validate config, schemas, conflicts) → Plan (probe items, build a DAG and stable plan summary) → Apply (execute deterministically with locks; cleanup runs in reverse order).
- Profiles & matching: profiles apply when `match` is true (e.g., `os("darwin")`); order of appearance defines precedence.
- Plugins & items: provider plugins (brew, file, exec, mise, shell-config, app-store) expose SDK builders; items implement `probe/validate/apply/cleanup`, are idempotent, and provide clear `render()` + stable `dedupe_key()`.
- Execution engine: Bun-based, dependency-aware scheduler; certain tools serialize operations. Prefer `@dot-steward/plugin-exec` for shell commands.
- Plans & state: plans are deterministic artifacts; local state tracks readiness, probes, checksums, and last plans for diagnostics.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat(scope): ...`, `fix: ...`, `refactor: ...` (see Git history).
- PRs should include: clear description, rationale, linked issues, and CLI screenshots/ascii output for user-facing changes.
- Keep changes minimal and focused; update `README.md`, `docs/`, and `examples/` when behavior or APIs change.

## Security & Configuration Tips
- Bun is required at runtime (CLI uses a Bun shebang). Some plugins may perform privileged operations; avoid destructive changes and ensure idempotency.
- Prefer invoking shell actions via the `exec` plugin to centralize permission handling and logging.
