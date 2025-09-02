# @dot-steward/plugin-repos

Repository discovery plugin that exposes metadata about plugins, packages, and apps to core. This replaces the former `@dot-steward/repos` package and follows the unified plugin model.

## Capabilities (planned)
- `repos.plugins` — discover and read `PluginManifest`s
- `repos.packages` — resolve abstract package names to provider-specific definitions
- `repos.apps` — fetch app bundles (packages, items, configs)

## Responsibilities
- Discover manifests from the workspace (e.g., `plugins/*`, `packages/*`, `apps/*`)
- Load and validate schemas against `@dot-steward/types`
- Provide stable iteration (`list`) and lookup (`get`, `resolve`) APIs

## Usage (planned, fluent)
Imported and orchestrated by core as a regular plugin:
```ts
import { Plugin } from "@dot-steward/types";

export default Plugin
  .define("repos")
  .capability("repos.plugins", schemaReposPlugins)
  .capability("repos.packages", schemaReposPackages)
  .capability("repos.apps", schemaReposApps)
  .probe(probeWorkspace)
  .diff(diffRepos)
  .action(accessRepos)
  .ready(checkWorkspace)
  .build();
```

Note: API surface is illustrative; no runtime is implemented yet.

