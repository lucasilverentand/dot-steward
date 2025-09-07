# Plugin Authoring Guide

This guide documents how to build first‑class, compatible plugins for dot‑steward. It covers core concepts, APIs, patterns, and best practices so your plugin integrates cleanly with the manager, the CLI, and other plugins.

## Concepts at a Glance
- Plugin: a top‑level capability provider (e.g., `brew`, `file`, `shell`, `mise`). Extends `Plugin` and may contribute items and/or perform setup.
- Item: a concrete desired change (e.g., a package, a file). Extends `Item` and implements lifecycle methods.
- SDK: the ergonomic API you expose (e.g., `brew.cask("google-chrome")`). Lives alongside your plugin to construct items.
- Profiles: users compose items per profile; the manager evaluates host matches and runs items in a dependency‑ordered DAG.

## Package Layout
- Name: `@dot-steward/plugin-<name>`
- Files:
  - `src/plugin.ts`: `class <Name>Plugin extends Plugin { ... }`
  - `src/sdk.ts`: user‑facing builders, return `Item` instances
  - `src/index.ts`: barrel re-exports
  - `package.json`:
    - `type: module`, `main: src/index.ts`, `exports: { ".": "./src/index.ts" }`
    - dependencies: `@dot-steward/core` (+ other plugin deps if needed)

Example `package.json`:
```json
{
  "name": "@dot-steward/plugin-foo",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "files": ["src"],
  "dependencies": {
    "@dot-steward/core": "workspace:*"
  }
}
```

## Writing a Plugin

Minimal plugin:
```ts
import { Plugin, os, type ItemStatus } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";

export class FooPlugin extends Plugin {
  constructor() { super("foo", os("linux", "darwin")); }
  async probe(_ctx: HostContext): Promise<ItemStatus> {
    // Detect availability/readiness; set status for plan display
    this.set_status("applied"); // or "pending" when setup is required
    return this.state.status;
  }
  async apply(_ctx: HostContext): Promise<void> {
    // Optional: perform plugin setup if needed
  }
}
export function fooPlugin(): FooPlugin { return new FooPlugin(); }
```

Host matching is required on `Plugin` and optional on items. Use `os(...)` or custom match expressions from `@dot-steward/core`.

### Using Other Plugins (Injection)
If your plugin needs another plugin (e.g., to run commands), declare it via `get_used_plugins()` for discovery and injection:
```ts
import { ExecPlugin } from "@dot-steward/plugin-exec";

export class FooPlugin extends Plugin {
  exec?: ExecPlugin;
}
(FooPlugin.prototype as any).get_used_plugins = function () {
  return [{
    key: "exec",
    get_plugin_factory: () => new ExecPlugin(),
    assign: (p: Plugin) => { (this as FooPlugin).exec = p as ExecPlugin; }
  }];
};
```
Manager will:
- Discover and register the dependency plugin
- Add dependency edges for correct ordering
- Inject the instance via `assign` if provided

## Writing Items

Items do the actual work and must be idempotent. Implement these methods:
- `probe(ctx)`: detect current state and set status (`applied`|`pending`|...). Keep it fast and rely on external tools when available.
- `validate(ctx)`: check configuration/preconditions. Throw on invalid input. When owners aren’t installed yet, degrade gracefully.
- `apply(ctx)`: perform changes. Must be idempotent. Use retries only for transient failures.
- `cleanup(ctx)`: optional removal logic.
- `has_upgrade/upgrade(ctx)`: optional upgrade flow.
- `plan(ctx)`: optional custom plan summary. Keep it succinct and stable.
- `render()`: label for logs/errors.
- `dedupe_key()`: return a stable string to merge identical items across profiles.

Skeleton:
```ts
import { Item, type ItemStatus } from "@dot-steward/core";
import type { HostContext } from "@dot-steward/core";
import { FooPlugin } from "./plugin.ts";

export class FooThing extends Item {
  readonly plugin?: FooPlugin;
  readonly plugin_key = "foo"; // duck-typed: enables discovery/binding

  constructor(readonly name: string, plugin?: FooPlugin) {
    super({ kind: "foo:thing", requires: plugin ? [plugin.id] : [] });
    this.plugin = plugin;
  }
  get_plugin_factory(): FooPlugin { return new FooPlugin(); }
  async probe(_ctx: HostContext): Promise<ItemStatus> { this.set_status("pending"); return this.state.status; }
  async validate(_ctx: HostContext): Promise<void> {}
  async apply(_ctx: HostContext): Promise<void> {}
  render(): string { return `[foo] ${this.name}`; }
  dedupe_key(): string { return `foo:${this.name}`; }
}
```

### Discovery and Binding Patterns
Manager discovers plugins and binds items using these signals (in order):
1) The item itself is a `Plugin` instance.
2) The item has a `plugin` property referencing a `Plugin` instance.
3) Duck‑typed: the item exposes `plugin_key` + `get_plugin_factory()` that returns a `Plugin` instance.

Best practice: implement (2) and (3). Accept an optional `plugin` in the constructor for explicit wiring, and always provide `plugin_key` + `get_plugin_factory()` so users don’t need to import the plugin class explicitly.

### Host Context
`HostContext` provides:
- `os`, `arch`, `env.variables`
- `user`: `home`, `uid/gid`, `is_root`, `can_sudo`
Use it for resolving paths under `$HOME`, shell selection, and conditional behavior.

### Running Commands
Prefer the `ExecPlugin` to run commands so sudo prompting and platform quirks are handled uniformly:
```ts
const res = await this.plugin?.exec?.run("echo hi", { shell: "bash", sudo: "auto" }, ctx);
if (!res?.ok) throw new Error(res?.stderr || "command failed");
```
If your item may run without injection, instantiate a local `ExecPlugin` as a fallback; the Manager will still discover/inject the real one when present.

## Idempotency, Planning, and Readability
- Probing should set `applied` only when the desired state is present.
- Plan summaries should be stable and readable (avoid UUIDs). Include the actionable bits (name, version, flags).
- Provide `dedupe_key()` to merge identical items across profiles (e.g., `brew:cask name|flags=...`).
- Use `render()` for concise labels in logs/errors.

## Concurrency and Ordering
- The Manager runs items concurrently with a dependency‑aware scheduler.
- Dependencies: add `requires: [plugin.id, ...]` (done automatically when you keep a `plugin` reference) so the owner plugin runs before items.
- Serialization: certain groups are serialized by the manager (e.g., `plugin_key === "brew"`). If your tool cannot handle parallel operations, build internal locking in your items or open a PR to introduce a group key.

## Validation Strategy
- Validate configuration shape synchronously using `zod` or simple checks, throw early.
- When probing/validating external resources (e.g., package existence), avoid network in the planner; use local commands when available and degrade gracefully when the owner tool isn’t installed yet.

## Example Patterns from Built‑ins
- Brew plugin:
  - Serializes operations (`plugin_key === "brew"`).
  - Formula/cask items validate tap/name consistency and provide `dedupe_key()`.
- Shell plugin:
  - Provides `shell.cmd()` and an idempotent `shell.profile` that manages rc blocks.
  - Offers an accumulator (`shell.rc`) so multiple contributors can compose the final profile.
- Mise plugin:
  - Ensures mise is installed via `curl https://mise.run | sh`.
  - Items set global tools via `mise use -g`.
  - Contributes activation lines to `shell.rc` once per config.

## SDK Design Tips
- Expose a fluent, typed SDK that constructs items with sensible defaults.
- Keep item constructors small; carry the important bits (name, flags), and compute everything else inside methods.
- Support multiple input shapes when ergonomic (e.g., `"node@lts"`, `{name, version}`), but normalize early.

## Error Reporting
- Throw `Error` with clear, actionable messages. The CLI aggregates errors by item and renders them with labels from `render()`.
- Avoid logging directly from items; rely on thrown errors and status changes.

## Testing and No‑Op Safety
- Ensure `apply()` can run repeatedly without drift.
- When writing files, prefer a managed block or a checksum approach to avoid overwriting user changes.
- When removing, be conservative (remove only content you own).

## Checklist
- [ ] `Plugin` with `name` and `matches`
- [ ] Item classes with `plugin_key` + `get_plugin_factory()`
- [ ] `probe()`, `validate()`, `apply()` implemented; idempotent
- [ ] `plan()` summaries and `render()` labels are readable
- [ ] `dedupe_key()` for mergeable items
- [ ] Optional `get_used_plugins()` for dependencies/injection
- [ ] Ergonomic `sdk.ts` builders
- [ ] Package `exports` wired to `src/index.ts`

If you have a plugin that needs a new concurrency group or common helper, open an issue/PR so we can standardize the pattern for all authors.
