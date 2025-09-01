# Dot Steward Monorepo

This repository is configured with [Bun](https://bun.sh) and [Turborepo](https://turbo.build) using the `@dot-steward/` scope.
It uses [Biome](https://biomejs.dev) for linting and formatting.

## Structure

- `packages/` - Shared packages

## Scripts

- `bun run build` - Run build across workspaces
- `bun run dev` - Start development servers
- `bun run lint` - Lint with Biome
- `bun run format` - Format code with Biome
- `bun run test` - Test all packages

## Getting Started

Ensure [Bun](https://bun.sh) is installed, then install dependencies:

```sh
bun install
```

Running commands uses Bun's `bun run` and Turborepo.
