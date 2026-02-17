# dot-steward (Rust Edition)

`dot-steward` is now a Rust-based CLI for planning and applying workstation setup tasks defined in a TOML configuration file.

## Install

```bash
cargo install --path .
```

## Configuration

Create `dot-steward.toml`:

```toml
[[tasks]]
name = "bootstrap-homebrew"
command = "brew bundle --file Brewfile"
description = "Install Homebrew packages"

[[tasks]]
name = "install-rust"
command = "rustup toolchain install stable"
```

## Usage

```bash
# Inspect execution order
cargo run -- plan -c dot-steward.toml

# Validate configuration structure and duplicate task names
cargo run -- validate -c dot-steward.toml

# Execute tasks sequentially
cargo run -- apply -c dot-steward.toml
```

## Development

This project uses [mise-en-place](https://mise.jdx.dev/) to pin local tooling and provide task shortcuts.

```bash
# Install pinned tools (Rust stable)
mise install

# Run all CI checks locally (format, lint, test)
mise run ci

# Or run individual checks
mise run fmt-check
mise run lint
mise run test
```
