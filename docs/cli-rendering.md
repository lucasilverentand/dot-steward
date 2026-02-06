# CLI Rendering System - Complete Technical Documentation

This document provides exhaustive technical details about how the CLI rendering system works in dot-steward, covering every aspect of the rendering pipeline from command input to terminal output.

## Architecture Overview

The CLI rendering system is built on a modular architecture that separates command processing, data transformation, and visual rendering into distinct layers.

### Core Dependencies

The rendering system leverages several specialized libraries:

- **Commander.js** - Command-line argument parsing and command structure
- **consola** - Logging framework with built-in colorization and formatting
- **picocolors** - Lightweight ANSI color utilities (16.8KB)
- **@clack/prompts** - Interactive CLI prompts with spinners and select components
- **string-width** - Accurate string width calculation accounting for ANSI escape codes
- **wrap-ansi** - Text wrapping that preserves ANSI color codes
- **listr2** - Task list management (imported but custom rendering preferred)

## Entry Points and Command Structure

### Main Entry Point

The CLI starts at `packages/cli/src/cli.ts`:

```typescript
#!/usr/bin/env bun
import { run } from "./program";
run();
```

This uses a Bun shebang for direct execution and immediately calls the program runner.

### Program Initialization

The `packages/cli/src/program.ts` file sets up the command structure:

1. Creates a Commander program instance with name "dot-steward"
2. Configures version from package.json
3. Registers three commands: `help`, `plan`, and `apply`
4. Each command is loaded from separate modules in `src/commands/`

## Rendering Utilities

### Panel System (`src/utils/ui.ts`)

The panel system creates structured visual blocks using Unicode box-drawing characters.

#### Character Set
- `│` (U+2502) - Vertical line for gutters
- `◆` (U+25C6) - Diamond for section titles
- `├─` (U+251C U+2500) - Tree branch connector
- `╰─` (U+2570 U+2500) - Tree end connector
- `└` (U+2514) - Corner connector

#### Panel Functions

**`renderPanelWithList(title: string, lines: string[]): string`**
- Creates a titled panel with a list of items
- Adds 2-space indentation to all lines
- Prefixes with vertical bar for gutter alignment

**`renderPanelSections(sections: Array<{ title: string; lines: string[] }>): string`**
- Renders multiple sections within a single panel
- Each section gets a diamond-prefixed title
- Maintains consistent spacing between sections

### Tree Rendering (`src/utils/planTree.ts`)

The tree renderer creates hierarchical visualizations for plans.

#### Tree Characters
- `╭─` (U+256D U+2500) - Rounded corner start
- `├─` (U+251C U+2500) - Branch connector
- `╰─` (U+2570 U+2500) - Rounded corner end
- `│` (U+2502) - Vertical continuation

#### Tree Structure

1. **Root Level**: Plugin names with task counts
2. **Profile Level**: Profile names under each plugin
3. **Task Level**: Individual task descriptions with action indicators

The tree maintains visual hierarchy without excessive indentation, using 2-space increments per level.

### Color and Symbol System (`src/utils/planFormat.ts`)

#### Action Indicators

Each action type has a specific color and symbol:

```typescript
const actionSymbols = {
  create: { symbol: '+', color: pc.green },
  modify: { symbol: '~', color: pc.yellow },
  destroy: { symbol: '!', color: pc.red },
  noop: { symbol: '-', color: pc.dim }
};
```

#### Status Symbols

Progress and completion states:

```typescript
const statusSymbols = {
  success: '✔' // green checkmark
  error: '✖'   // red X
  running: '→' // cyan arrow
  skipped: '↷' // yellow rotate arrow
  pending: '○' // gray circle
};
```

## Command Processing Pipeline

### Plan Command Flow

1. **Configuration Loading**
   - Searches for `steward.config.ts` or `steward.config.js`
   - Uses Bun's native TypeScript support for direct loading
   - Validates configuration structure

2. **Manager Initialization**
   - Creates Manager instance from core package
   - Registers plugins and profiles from config

3. **Plan Computation**
   - Calls `mgr.plan()` to generate decisions
   - Groups decisions by plugin and profile
   - Calculates action summaries

4. **Panel Construction**
   - Host details panel with system information
   - Plan tree with grouped actions
   - Summary statistics panel

5. **State Persistence**
   - Saves to `~/.dot-steward/last-plan.json`
   - Includes timestamp and full decision tree

### Apply Command Flow

1. **Plan State Loading**
   - Reads from `~/.dot-steward/last-plan.json`
   - Validates plan freshness and compatibility

2. **Confirmation Prompt**
   - Interactive Yes/No selector using @clack/prompts
   - Keyboard navigation with arrow keys, space, enter
   - Vim key support (h/j/k/l) and WASD

3. **Progress Rendering**
   - Real-time task execution display
   - Spinner animation for running tasks
   - Line-by-line status updates

4. **Apply State Tracking**
   - Records results in `~/.dot-steward/last-apply.json`
   - Tracks successes, failures, and skips

## Interactive Elements

### Confirmation Dialog

The apply command's confirmation uses a custom select prompt:

```typescript
const confirmed = await select({
  message: 'Do you want to apply this plan?',
  options: [
    { value: true, label: 'Yes' },
    { value: false, label: 'No' }
  ],
  initialValue: false
});
```

Features:
- Visual selection indicator (›)
- Keyboard shortcuts displayed
- Immediate response on selection

### Progress Display

Real-time progress updates during apply:

1. **Spinner Animation**
   - Rotating character sequence: `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`
   - 80ms rotation interval
   - Stops on task completion

2. **Status Updates**
   - Running: cyan arrow with task description
   - Success: green checkmark with completion message
   - Error: red X with error details
   - Skipped: yellow rotate arrow

3. **Terminal Management**
   - Clears and repaints for smooth updates
   - Preserves scrollback in non-TTY environments
   - Handles terminal resize events

## Output Formatting

### Table Rendering (`src/utils/table.ts`)

The table system provides responsive column layouts:

1. **Column Width Calculation**
   - Measures content width using string-width
   - Accounts for ANSI escape sequences
   - Applies minimum and maximum constraints

2. **Responsive Sizing**
   - Detects terminal width via process.stdout.columns
   - Proportionally shrinks columns to fit
   - Maintains readability with ellipsis truncation

3. **Text Wrapping**
   - Uses wrap-ansi for ANSI-aware wrapping
   - Preserves color codes across line breaks
   - Maintains indentation in wrapped lines

### Summary Formatting

Summary panels show aggregated statistics:

```typescript
Summary:
  3 to create
  2 to modify
  1 to destroy
  4 unchanged
```

Each line is color-coded to match its action type.

## Environment Detection

### TTY Detection

The CLI checks for interactive terminal:

```typescript
const isTTY = process.stdout.isTTY;
```

Behavior differences:
- **TTY**: Full interactive features, colors, spinners
- **Non-TTY**: Simple text output, no animations

### CI Environment

Detects CI/CD environments:

```typescript
const isCI = process.env.CI === 'true' || 
              process.env.GITHUB_ACTIONS === 'true' ||
              process.env.CODESPACES === 'true';
```

Shows environment badge in host details panel.

## State Management

### Plan State Structure

Saved in `~/.dot-steward/last-plan.json`:

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "host": {
    "os": "darwin",
    "arch": "arm64",
    "user": "username"
  },
  "decisions": [
    {
      "plugin": "homebrew",
      "profile": "default",
      "label": "package-name",
      "action": "create",
      "context": {}
    }
  ]
}
```

### Apply State Structure

Saved in `~/.dot-steward/last-apply.json`:

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "results": {
    "succeeded": ["homebrew:default:package-name"],
    "failed": [],
    "skipped": []
  },
  "errors": {}
}
```

## Error Handling and Display

### Error Collection

Errors are aggregated during execution:

```typescript
const errors: Record<string, Error> = {};
for (const decision of decisions) {
  try {
    await applyDecision(decision);
  } catch (error) {
    errors[decision.id] = error;
  }
}
```

### Error Rendering

Errors display with context:

```
✖ homebrew:default:package-name
  Error: Command failed: brew install package-name
  Package not found in tap
```

Features:
- Red coloring for visibility
- Indented error messages
- Preserved stack traces in verbose mode

## Text Processing Pipeline

### ANSI Code Handling

1. **Stripping**: Remove ANSI codes for width calculation
2. **Preservation**: Maintain codes through wrapping/truncation
3. **Injection**: Add codes for colorization

### String Width Calculation

Accurate width accounting for:
- Unicode characters (emoji, CJK)
- Zero-width joiners
- Combining characters
- ANSI escape sequences

### Text Wrapping Algorithm

1. Calculate available width
2. Find break points (spaces, hyphens)
3. Split at optimal positions
4. Preserve ANSI codes across splits
5. Maintain indentation levels

## Performance Optimizations

### Rendering Efficiency

1. **Batch Updates**: Collects multiple changes before rendering
2. **Differential Updates**: Only repaints changed lines
3. **String Building**: Uses array join instead of concatenation
4. **ANSI Caching**: Reuses color code strings

### Memory Management

1. **Streaming Output**: Processes large outputs in chunks
2. **Lazy Loading**: Commands loaded on-demand
3. **State Cleanup**: Removes old state files automatically

## Special Features

### Removed Items Tracking

Shows items removed since last apply:

```typescript
const removed = lastApply.results.succeeded.filter(
  id => !currentPlan.decisions.find(d => d.id === id)
);
```

Displays with special formatting:
```
Previously applied but now removed:
  - package-name (was installed)
```

### Profile Matching Display

Shows which profiles match current system:

```
Profiles:
  ✓ darwin (matches)
  ✗ linux (no match)
```

Uses green checkmarks for matches, red X for non-matches.

### Host Information Panel

Displays comprehensive system details:

```
Host Details:
  OS: darwin (macOS)
  Arch: arm64
  User: username
  Home: /Users/username
  Environment: local/ci/devcontainer
```

## Extensibility Points

### Custom Renderers

Plugins can provide custom renderers:

```typescript
interface CustomRenderer {
  renderDecision(decision: Decision): string;
  renderProgress(decision: Decision): string;
  renderResult(decision: Decision, result: any): string;
}
```

### Theme Support

Color themes can be customized:

```typescript
const theme = {
  primary: picocolors.cyan,
  success: picocolors.green,
  warning: picocolors.yellow,
  error: picocolors.red,
  dim: picocolors.dim
};
```

### Output Adapters

Different output formats supported:
- Terminal (default)
- JSON (--json flag)
- Plain text (--no-color flag)
- Machine-readable (--format=json)

## Testing Considerations

### Rendering Tests

1. **Snapshot Testing**: Captures rendered output
2. **ANSI Stripping**: Tests without color codes
3. **Width Variations**: Tests different terminal widths
4. **Mock TTY**: Simulates interactive environments

### Integration Points

1. **Command Tests**: Full command execution
2. **Prompt Tests**: Interactive element behavior
3. **State Tests**: Persistence and loading
4. **Error Tests**: Error handling and display

## Debugging Features

### Verbose Mode

Enabled with --verbose flag:
- Shows full stack traces
- Displays internal state
- Logs rendering decisions
- Times operation durations

### Debug Output

Environment variable `DEBUG=dot-steward:*`:
- Logs all rendering operations
- Shows ANSI code sequences
- Displays width calculations
- Traces state transitions

## Implementation Details

### Rendering Loop

1. **Input Processing**: Parse and validate input
2. **State Computation**: Calculate what to render
3. **Layout Calculation**: Determine dimensions
4. **Content Generation**: Build output strings
5. **ANSI Enhancement**: Add colors and styles
6. **Terminal Output**: Write to stdout
7. **State Update**: Save any state changes

### Buffer Management

Output buffering strategy:
1. Build complete frames in memory
2. Write atomically to prevent tearing
3. Use double-buffering for animations
4. Clear buffer on interrupts

### Signal Handling

Graceful handling of:
- SIGINT (Ctrl+C): Clean shutdown
- SIGTERM: Save state and exit
- SIGWINCH: Terminal resize

## Platform Considerations

### Cross-Platform Support

1. **Windows**: Uses Windows Terminal detection
2. **macOS**: Native Terminal.app support
3. **Linux**: XTerm-256color compatibility

### Terminal Emulator Detection

Detects specific terminals:
- iTerm2: Enhanced image support
- Windows Terminal: Full Unicode
- VS Code Terminal: Integrated features

### Fallback Modes

Graceful degradation:
1. No color support: Plain text
2. Limited Unicode: ASCII alternatives
3. Narrow terminals: Abbreviated output
4. No TTY: Machine-readable format

---

This document represents the complete technical implementation of the CLI rendering system in dot-steward, covering every aspect from low-level character handling to high-level command orchestration.