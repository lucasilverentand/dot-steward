# @dot-steward/core

Unified core that provides the analyze/plan/apply phases and the execution engine in a cohesive API. Core orchestrates plugins (including the repos plugin) and exposes a fluent, chainable design.

## Responsibilities
- Provide `analyze`, `plan`, and `apply` primitives and execution engine
- Orchestrate plugins (e.g., file, git, brew, apt, repos)
- Provide a simple programmatic API and serve as the basis for the CLI

## Usage (class-based plugins)
```ts
import { DotFileManager, config, profile } from "@dot-steward/core";
import { BrewPlugin } from "@dot-steward/plugin-brew";

const brew = new BrewPlugin();
const cfg = config({
  profiles: [
    profile("base", {
      // Use the same instance to construct items
      items: [
        brew.formula({ name: "git" }),
        brew.tap("homebrew/cask"),
      ],
    }),
  ],
  plugins: [brew],
});

const mgr = new DotFileManager();
const analyzeReport = mgr.analyze(cfg);
const plan = mgr.plan(cfg);
const applyReport = await mgr.apply(plan);
```

You can also register plugin instances imperatively:
```ts
mgr.withPlugins([brewPlugin /*, more */]);
```

Note: A more fluent builder is still planned; the above is the minimal surface for plugin acceptance.
