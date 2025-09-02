# @dot-steward/types

Shared TypeScript types for the dot-steward ecosystem. This package defines the core contracts referenced in `docs/design.md`. Types are designed to support fluent, chainable APIs across core and plugins.

## Purpose
- Provide stable, shared type definitions across core and plugins.
- Enable compile-time safety for items, plans, phases, profiles, and plugin contracts.

## Included types (initial set)
- `PluginManifest`, `PluginCapability`, `PluginReadiness`, `SetupRequirement`
- `ManagedItemId`, `ManagedItemKind`, `ManagedItem<TSpec>`
- `Change`, `Diff`, `RiskLevel`, `RollbackPolicy`, `ActionSpec`
- `Plan`, `PlanHeader`, `PlanNode` (alias of `ActionNode`), `PlanEdge`, `PlanHash`
- `AnalyzeIssue`, `AnalyzeReport`, `ApplyResult`, `ApplyReport`
- `Profile`, `Matcher`, `HostFacts`, `PluginRef`, `AppRef`
- `PackageMapping`, `ProviderPackageSpec`

## Usage
```ts
import type { Plan, ApplyReport, PluginManifest } from "@dot-steward/types";
import { Plugin } from "@dot-steward/types";

// Define a plugin (example)
export default Plugin
  .define("example")
  .capability("example.capability")
  .supports((item, ctx) => item.kind === "example")
  .on("example.capability", {
    probe: (item, ctx) => ({}),
    diff: (cur, desired, ctx) => ({ current: cur, desired, idempotent: true }),
    action: (node, ctx) => {},
  })
  .ready(({ host }) => ({ status: "ready" }))
  .build();
```
