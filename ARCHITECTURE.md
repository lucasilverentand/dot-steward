# Architecture Overview

This document provides a high-level overview of dot-steward's architecture and design decisions.

## System Architecture

```
┌─────────────────────────────────────────────────────┐
│                  CLI Application                     │
│                (@dot-steward/cli)                    │
├─────────────────────────────────────────────────────┤
│              Manager (Orchestration)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Config   │  │ Analyzer │  │ Dependency Graph │ │
│  │ Loader   │  │          │  │                  │ │
│  └──────────┘  └──────────┘  └──────────────────┘ │
├─────────────────────────────────────────────────────┤
│                   Core Library                       │
│                (@dot-steward/core)                   │
│  ┌──────────────────────────────────────────────┐  │
│  │ Plugin System                                 │  │
│  │  • Plugin Discovery                           │  │
│  │  • Plugin Registry                            │  │
│  │  • Plugin Lifecycle                           │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │ Event System (EventBus)                      │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │ State Management                              │  │
│  │  • Local State (.dot-steward/state.json)     │  │
│  │  • State Validation                           │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │ Error Handling                                │  │
│  │  • Custom Error Classes                       │  │
│  │  • Error Context                              │  │
│  └──────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│                    Plugins                           │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌────────┐  │
│  │ brew │ │ file │ │ exec │ │ mise │ │  ...   │  │
│  └──────┘ └──────┘ └──────┘ └──────┘ └────────┘  │
└─────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Items

**Items** are the fundamental unit of configuration. Each item represents a desired state for a specific resource (file, package, setting, etc.).

**Lifecycle:**
1. **Analyze**: Discover items from configuration
2. **Probe**: Check current state
3. **Plan**: Determine actions needed
4. **Apply**: Execute changes
5. **Validate**: Verify results

**Example Item:**
```typescript
{
  id: "uuid",
  plugin_key: "file",
  data: { path: "~/.bashrc", source: "..." },
  depends_on: ["shell-config"],
  async probe(host) { /* check if file exists */ },
  async apply(host) { /* create/update file */ },
  async validate(host) { /* verify file */ }
}
```

### 2. Plugins

**Plugins** provide implementation for specific resource types. They define how to:
- Analyze configuration to produce items
- Check current state (probe)
- Apply changes
- Validate results

**Plugin Interface:**
```typescript
interface Plugin<T> {
  plugin_key: string;
  name: string;
  version: string;

  analyze(config: T): Promise<Item[]>;
  plan(items: Item[]): Promise<PlanSummary>;
  apply(items: Item[]): Promise<ApplyResult>;
}
```

### 3. Profiles

**Profiles** group items with host matching rules. Only items in matching profiles are applied.

```typescript
{
  name: "darwin-desktop",
  matches: all(os("darwin"), env("DESKTOP", "true")),
  items: [...]
}
```

### 4. Dependency Graph

The **DependencyGraph** manages dependencies between items and ensures correct execution order.

**Features:**
- Topological sorting
- Cycle detection
- Parallel execution where possible
- Serialization for specific plugins (e.g., brew)

### 5. Event System

The **EventBus** provides event-driven architecture for observability and extension.

**Event Categories:**
- `manager:*` - Manager lifecycle
- `config:*` - Configuration loading
- `item:*` - Item operations
- `plugin:*` - Plugin discovery/lifecycle

**Example:**
```typescript
bus.on('item:apply:start', ({ item_id }) => {
  console.log(`Applying ${item_id}...`);
});
```

### 6. State Management

**State** persists item status between runs for idempotency.

**State File:** `.dot-steward/state.json`

```json
{
  "version": 1,
  "items": {
    "item-uuid": {
      "status": "applied",
      "last_applied": "2025-01-15T10:30:00Z",
      "checksum": "..."
    }
  }
}
```

### 7. Error Handling

**Custom Error Classes** provide structured error information:

- `DotStewardError` - Base error class
- `ConfigurationError` - Config issues
- `PluginError` - Plugin failures
- `ValidationError` - Validation failures
- `ApplyError` - Application failures
- And more...

**Example:**
```typescript
throw new ValidationError(
  'Invalid file path',
  itemId,
  { path: '/invalid/path', reason: 'Path does not exist' }
);
```

## Execution Flow

### Initialization

```
1. Load Configuration
   ├─ Import config file (.ts)
   ├─ Parse profiles/items
   └─ Validate schema

2. Host Detection
   ├─ Detect OS, arch, hostname
   ├─ Load environment variables
   └─ Evaluate profile matches

3. Plugin Discovery
   ├─ Scan items for plugins
   ├─ Load plugin factories
   └─ Build plugin registry

4. Build Dependency Graph
   ├─ Add items and plugins
   ├─ Resolve dependencies
   └─ Detect cycles
```

### Apply Flow

```
1. Plan Phase
   ├─ Probe each item
   ├─ Compare with desired state
   ├─ Determine actions (apply/skip/noop)
   └─ Validate preconditions

2. Apply Phase
   ├─ Sort by dependencies
   ├─ Execute in parallel where possible
   │  ├─ Validate item
   │  ├─ Apply changes
   │  └─ Retry on failure
   ├─ Update state
   └─ Emit events

3. Validation Phase
   ├─ Verify all changes
   └─ Report errors
```

## Design Decisions

### 1. TypeScript with Strict Mode

**Rationale:** Type safety prevents runtime errors and improves maintainability.

**Implementation:**
- `strict: true` in tsconfig.json
- No `any` types allowed
- Type guards for runtime checks
- Proper error types

### 2. Event-Driven Architecture

**Rationale:** Enables observability, testing, and extension without tight coupling.

**Benefits:**
- CLI can listen to events for UI updates
- Plugins can emit custom events
- Easy to add logging/telemetry
- Testable in isolation

### 3. Declarative Configuration

**Rationale:** Configuration as code enables version control, review, and reproducibility.

**Features:**
- TypeScript-based config
- Type-safe configuration
- Composable profiles
- Host-specific matching

### 4. Plugin Architecture

**Rationale:** Extensibility without core modifications.

**Benefits:**
- Third-party plugins possible
- Clear separation of concerns
- Independent versioning
- Testable in isolation

### 5. Dependency-Aware Execution

**Rationale:** Correct ordering ensures successful application.

**Implementation:**
- Dependency graph with topological sort
- Cycle detection
- Parallel execution where safe
- Explicit serialization hints

### 6. Idempotency

**Rationale:** Safe to run multiple times without side effects.

**Implementation:**
- State tracking
- Probe before apply
- Checksum validation
- Declarative desired state

## Performance Considerations

### Parallelization

- Items without dependencies execute in parallel
- Plugin-specific serialization (e.g., `brew` runs serially)
- Async/await throughout

### Caching

- State file prevents redundant work
- Plugin discovery cached per session
- Host context computed once

### Optimization Opportunities

1. **Plugin Loading**: Lazy load plugins on demand
2. **State Management**: Incremental state updates
3. **Dependency Resolution**: Cache sorted graph
4. **Event Emission**: Batch events for better performance

## Security Considerations

### Input Validation

- Zod schema validation
- Path sanitization (planned)
- Environment variable validation

### Privilege Escalation

- Explicit sudo where needed
- Audit trail for privileged operations (planned)
- Minimal privilege principle

### State Security

- State file permissions
- No secrets in state
- Secrets management (planned)

## Testing Strategy

### Unit Tests

- Core algorithms (deps, events, matching)
- Error handling
- Type guards
- State management

### Integration Tests

- Full Manager lifecycle
- Plugin integration
- CLI commands

### E2E Tests (Planned)

- Real system configuration
- Container-based testing
- Cross-platform validation

## Future Enhancements

1. **State Versioning**: Automatic migration between versions
2. **Rollback**: Undo failed changes
3. **Dry-run Mode**: Simulate without changes
4. **Remote State**: Share state across machines
5. **Secrets Management**: Encrypted configuration values
6. **Plugin Marketplace**: Discover and install plugins
7. **Web UI**: Visual configuration management
8. **Telemetry**: Usage analytics (opt-in)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

---

This architecture is designed to be **extensible**, **maintainable**, and **type-safe**. All changes should align with these principles.
