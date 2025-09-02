# @dot-steward/plugin-brew

Homebrew plugin for managing formulas and taps on macOS (and Linuxbrew). Exposes a fluent registration API.

## Capabilities (planned)
- `brew.formula` — ensure a Homebrew formula is installed at a specific version (optional)
- `brew.tap` — ensure a tap is added

## Readiness
- Verifies `brew` is installed and usable; surfaces guidance if not

## Usage
```ts
import { BrewPlugin } from "@dot-steward/plugin-brew";
import { config, profile, DotFileManager } from "@dot-steward/core";

const brew = new BrewPlugin();

const cfg = config({
  plugins: [brew],
  profiles: [
    profile("darwin-base", {
      items: [
        brew.formula("git"),
        brew.tap("homebrew/cask"),
      ],
    }),
  ],
});

const mgr = new DotFileManager();
const plan = mgr.plan(cfg);
```

Actions are idempotent; apply remains a no-op until wired.
