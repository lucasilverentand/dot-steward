# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Infrastructure
- **TypeScript strict mode** - Added comprehensive tsconfig.json with strict type checking
- **Testing framework** - Set up Bun test with test utilities and example tests
- **CI/CD pipelines** - GitHub Actions workflows for lint, type-check, test, and security scanning
- **Custom error classes** - Comprehensive error hierarchy for better error handling
- **Type guards** - Runtime type checking utilities for safer type casting
- **Contributing guide** - Detailed contribution guidelines and development workflow
- **Architecture documentation** - Comprehensive architecture overview

#### Core Improvements
- **Error handling system** - Custom error classes with context and proper error propagation
- **Type safety improvements** - Replaced `as unknown as` casts with type guards
- **Event system validation** - Better type safety for event emissions
- **State management** - Foundation for state versioning (in progress)

#### Testing
- **Test infrastructure** - Test utilities and mock helpers
- **Unit tests** for core modules:
  - Dependency graph (deps.test.ts)
  - Event bus (events.test.ts)
  - Error classes (errors.test.ts)
- **Test coverage tracking** - Coverage reporting configured

#### CI/CD
- **Lint workflow** - Automated code style checking
- **Type-check workflow** - TypeScript strict mode validation
- **Test workflow** - Cross-platform test execution (Ubuntu, macOS)
- **Security workflow** - CodeQL analysis and dependency scanning
- **PR checks** - Automated validation for pull requests

### Changed
- **Manager.ts** - Improved type safety with type guards instead of unsafe casts
- **Item.ts** - Better crypto.randomUUID detection with proper type guards
- **Package scripts** - Added `type-check`, `test`, `validate` commands
- **Monorepo structure** - Added tsconfig.json to all packages and plugins

### Improved
- **Code quality** - Removed unsafe type casts
- **Developer experience** - Better error messages with context
- **Maintainability** - Clearer code with proper types
- **Documentation** - Architecture and contributing guides

### Fixed
- Type safety issues in manager initialization
- Plugin discovery type casting
- Item deduplication type safety

## [0.1.0] - Previous Release

### Added
- Initial project structure
- Core plugin system
- Basic CLI implementation
- 9 built-in plugins (brew, file, exec, mise, shell-config, app-store, ghostty, macos-settings, starship)
- Profile-based configuration
- Dependency graph management
- Event-driven architecture

---

## Upgrade Guide

### From 0.1.x to Current

#### TypeScript Changes
If you're developing plugins or extending dot-steward:

1. **Update imports** - Type guards are now available:
   ```typescript
   import { isPlugin, hasPluginKey, wrapError } from '@dot-steward/core';
   ```

2. **Use error classes** - Replace generic errors:
   ```typescript
   // Before
   throw new Error('Invalid config');

   // After
   import { ConfigurationError } from '@dot-steward/core';
   throw new ConfigurationError('Invalid config', { field: 'profiles' });
   ```

3. **Type safety** - If you have custom type casts, consider using type guards:
   ```typescript
   // Before
   const plugin = item as unknown as Plugin;

   // After
   import { isPlugin } from '@dot-steward/core';
   if (isPlugin(item)) {
     // item is now properly typed as Plugin
   }
   ```

#### Testing
New test infrastructure is available:

```typescript
import { createMockItem, createMockPlugin } from '@dot-steward/core/__tests__/test-utils';

test('my test', () => {
  const item = createMockItem('test-id');
  // ...
});
```

#### CI/CD
If you're running this in CI:

```yaml
# Add to your workflow
- name: Validate
  run: bun run validate
```

---

## Migration Notes

### Breaking Changes
None in this release - all changes are backward compatible.

### Deprecations
None.

### New Features You Should Use
1. **Error classes** - Better error handling and debugging
2. **Type guards** - Safer type checking
3. **Testing utilities** - Easier to write tests
4. **Validation script** - Run all checks with `bun run validate`

---

For more details, see:
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Architecture overview
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Development guide
- [GitHub Releases](https://github.com/lucasilverentand/dot-steward/releases) - Full release notes
