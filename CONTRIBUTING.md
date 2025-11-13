# Contributing to dot-steward

Thank you for your interest in contributing to dot-steward! This document provides guidelines and information for contributors.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh/) v1.0.0 or higher
- Git
- A code editor (VS Code recommended)

### Getting Started

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/dot-steward.git
   cd dot-steward
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Run validation checks**
   ```bash
   bun run validate
   ```
   This runs linting, type-checking, and tests.

## Project Structure

```
dot-steward/
├── packages/
│   ├── core/          # Core library
│   └── cli/           # CLI application
├── plugins/           # Built-in plugins
│   ├── brew/
│   ├── file/
│   ├── exec/
│   └── ...
├── docs/              # Documentation
├── examples/          # Example configurations
└── scripts/           # Build and utility scripts
```

## Development Workflow

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write code following the style guide
   - Add tests for new functionality
   - Update documentation as needed

3. **Run validation**
   ```bash
   # Run linter
   bun run lint

   # Run type checker
   bun run type-check

   # Run tests
   bun test

   # Or run all at once
   bun run validate
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` - New features
   - `fix:` - Bug fixes
   - `docs:` - Documentation changes
   - `test:` - Test additions or changes
   - `refactor:` - Code refactoring
   - `chore:` - Maintenance tasks

5. **Push and create a pull request**
   ```bash
   git push origin feature/your-feature-name
   ```

### Code Quality Standards

#### TypeScript

- **Strict mode enabled**: All code must pass strict TypeScript checks
- **No `any` types**: Use proper type annotations or type guards
- **Type guards**: Use type guards from `type-guards.ts` for runtime type checking
- **Avoid `as unknown as`**: Prefer type guards and proper typing

#### Error Handling

- **Use custom error classes**: Import from `errors.ts`
- **Never silence errors**: Always log or emit events for errors
- **Provide context**: Include relevant information in error messages
- **Example**:
  ```typescript
  import { ValidationError, wrapError } from '@dot-steward/core';

  try {
    // ... operation
  } catch (error) {
    throw new ValidationError(
      'Invalid configuration',
      itemId,
      { originalError: wrapError(error, 'Config validation failed') }
    );
  }
  ```

#### Testing

- **Test coverage target**: 80% for core, 60% for plugins
- **Test file naming**: `*.test.ts`
- **Use test utilities**: Import from `__tests__/test-utils.ts`
- **Example**:
  ```typescript
  import { describe, test, expect } from 'bun:test';
  import { createMockItem } from './__tests__/test-utils.ts';

  describe('MyFeature', () => {
    test('should do something', () => {
      const item = createMockItem('test');
      // ...
      expect(result).toBe(expected);
    });
  });
  ```

### Running Tests

```bash
# Run all tests
bun test

# Run tests with coverage
bun test --coverage

# Run specific test file
bun test packages/core/src/__tests__/deps.test.ts

# Watch mode (if supported)
bun test --watch
```

### Linting and Formatting

```bash
# Check code style
bun run lint

# Auto-fix linting issues
biome check --apply .

# Format code
bun run format
```

## Plugin Development

To create a new plugin:

1. **Create plugin directory**
   ```bash
   mkdir plugins/my-plugin
   cd plugins/my-plugin
   ```

2. **Set up package.json**
   ```json
   {
     "name": "@dot-steward/plugin-my-plugin",
     "version": "0.1.0",
     "type": "module",
     "exports": "./src/index.ts",
     "dependencies": {
       "@dot-steward/core": "workspace:*"
     }
   }
   ```

3. **Implement plugin**
   See `docs/plugin-authoring.md` for detailed guidance.

4. **Add tests**
   Create `src/__tests__/my-plugin.test.ts`

5. **Update documentation**
   Add a README.md describing your plugin's functionality.

## Documentation

- **API documentation**: Use TSDoc comments for all public APIs
- **User documentation**: Update relevant docs in `docs/`
- **Examples**: Add examples to `examples/` for new features
- **README**: Update main README.md if adding user-facing features

## Continuous Integration

All pull requests run through automated checks:

- ✅ Linting (Biome)
- ✅ Type checking (TypeScript)
- ✅ Tests (Bun test)
- ✅ Security scanning (CodeQL)

Ensure all checks pass before requesting review.

## Submitting Pull Requests

### Before Submitting

- [ ] All tests pass locally
- [ ] Code follows style guidelines
- [ ] New code has tests
- [ ] Documentation is updated
- [ ] Commit messages follow Conventional Commits
- [ ] No breaking changes (or clearly documented)

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How was this tested?

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes
```

## Release Process

Releases are managed by maintainers:

1. Version bumped via `bun run release:version`
2. CHANGELOG updated
3. Git tag created
4. Packages published via `bun run release:publish`

## Getting Help

- **Documentation**: Check `docs/` directory
- **Issues**: Search existing issues or create a new one
- **Discussions**: Use GitHub Discussions for questions

## Code of Conduct

Please note that this project follows a Code of Conduct. By participating, you agree to abide by its terms.

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

**Thank you for contributing to dot-steward!** 🎉
