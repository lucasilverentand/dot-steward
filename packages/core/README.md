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

const cfg = config([
  profile({
    name: "base",
    // Use the same instance to construct items
    items: [
      brew.formula("git"),
      brew.tap("homebrew/cask"),
    ],
  }),
]);

const mgr = new Manager();
await mgr.init("file:///abs/path/to/dot-steward.config.ts");
await mgr.analyze();
await mgr.apply();
```

## Profile Inputs and Conditional Composition
Profiles declare inputs using a Zod schema and build items conditionally based on those inputs. Defaults are defined in the Zod schema.

```ts
import { profile, os } from "@dot-steward/core";
import { z } from "zod";
import { brew } from "@dot-steward/plugin-brew";

const workstation = profile({
  name: "workstation",
  matches: os("darwin"),
  inputs: z.object({
    browser: z.enum(["chrome", "firefox"]).default("chrome"),
    devtools: z.boolean().default(true),
  }),
  items: ({ input, when }) => [
    ...when(input.browser === "chrome", brew.cask("google-chrome")),
    ...when(input.browser === "firefox", brew.cask("firefox")),
    ...when(input.devtools, [brew.formula("git"), brew.formula("node")]),
  ],
});
```
```
