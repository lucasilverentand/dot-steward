# Dot Steward Monorepo

Dot Steward is a typed toolkit for describing machine setup and dotfile management. It provides a plugin-based API built with Zod so you can declaratively describe packages, files, and shell configuration that make up your environment.

This repository is organized as a Bun/Turborepo monorepo and publishes packages under the `@dot-steward/` scope.

## Packages

- `packages/` – shared libraries and the CLI.
  - `@dot-steward/core` – shared types and the base `Plugin` class.
  - `@dot-steward/cli` – command-line interface.
  - `@dot-steward/matchers` – common matchers like `darwin`, `linux`, and logical `any`.
- `plugins/` – modular plugins that contribute item types:
  - `@dot-steward/apt` – APT packages for Debian/Ubuntu systems.
  - `@dot-steward/brew` – Homebrew taps, formulas, and casks.
  - `@dot-steward/command` – run arbitrary shell commands.
  - `@dot-steward/file` – ensure files, directories, or symlinks exist.
  - `@dot-steward/shell` – manage env variables, aliases, and PATH entries.

## Usage

Run the CLI with Bun:

```sh
bunx @dot-steward/cli
```

For local development inside this repo:

```sh
# install deps (postinstall auto-links the CLI globally for local dev)
bun install

# ensure Bun's global bin is on your PATH (once):
#   echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.zshrc  # or ~/.bashrc

# run the linked CLI globally
stew

# alternatively: run the workspace package directly (no global link needed)
bun run cli

# or from the package folder
bun run -C packages/cli dev
```

Plans group profiles with match conditions and a list of items from the plugin ecosystem.

## Scripts

- `bun run build` – run build across workspaces.
- `bun run dev` – start development servers.
- `bun run lint` – lint with Biome.
- `bun run lint:fix` – automatically fix lint issues.
- `bun run format` – format code with Biome.
- `bun run test` – run tests for all packages.

## Getting Started

Install dependencies using [Bun](https://bun.sh):

```sh
bun install
```

Commands use Bun's `bun run` and Turborepo to execute across packages.

## License

This project is licensed under the [MIT License](LICENSE).
