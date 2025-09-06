# @dot-steward/core

Unified core that provides the analyze/plan/apply phases and the execution engine in a cohesive API. Core orchestrates plugins (including the repos plugin) and exposes a fluent, chainable design.

## Responsibilities
- Provide `analyze`, `plan`, and `apply` primitives and execution engine
- Orchestrate plugins (e.g., file, git, brew, apt, repos)
- Provide a simple programmatic API and serve as the basis for the CLI

## Usage (class-based plugins)
```ts
import { Manager, config, profile } from "@dot-steward/core";
import { brew } from "@dot-steward/plugin-brew";

const cfg = config({
  profiles: [
    profile({
      name: "base",
      // Use the same instance to construct items
      items: [
        brew.formula("git"),
        brew.tap("homebrew/cask"),
      ],
    }),
  ],
});

const mgr = new Manager();
await mgr.init("file:///abs/path/to/dot-steward.config.ts");
await mgr.analyze();
await mgr.apply();
```

## Profile Inputs and Conditional Composition
Profiles can declare inputs and build items conditionally based on those inputs. Inputs can have defaults. No environment-variable sourcing is used here.

```ts
import { profile, os } from "@dot-steward/core";
import { brew } from "@dot-steward/plugin-brew";

const workstation = profile({
  name: "workstation",
  matches: os("darwin"),
  inputs: {
    browser: { type: "select", choices: ["chrome", "firefox"], default: "chrome" },
    devtools: { type: "boolean", default: true },
  },
  items: ({ input, when }) => [
    ...when(input.browser === "chrome", brew.cask("google-chrome")),
    ...when(input.browser === "firefox", brew.cask("firefox")),
    ...when(!!input.devtools, [brew.formula("git"), brew.formula("node")]),
  ],
});
```
```
