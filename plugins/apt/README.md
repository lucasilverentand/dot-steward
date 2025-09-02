# @dot-steward/plugin-apt

APT plugin for managing Debian/Ubuntu packages and repositories. Exposes a fluent registration API.

## Capabilities (planned)
- `apt.package` — ensure an apt package is installed (optionally pinned)
- `apt.repo` — ensure an APT source is configured
- `apt.key` — manage trusted repository keys

## Readiness
- Verifies `apt` tooling exists; may require elevated privileges for system changes

## Usage
```ts
import { apt } from "@dot-steward/plugin-apt";
import { defineProfile, defineConfig, DotFileManager } from "@dot-steward/core";

const ap = apt();

const p = defineProfile("debian", {
  plugins: ["apt"],
  items: [
    ap.package("curl"),
    ap.repo("myrepo"),
  ],
});

const cfg = defineConfig({ profiles: [p], plugins: [ap] });
const mgr = new DotFileManager();
const plan = mgr.plan(cfg);
```

Actions are idempotent; apply remains a no-op until wired.
