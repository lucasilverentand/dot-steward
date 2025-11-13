/**
 * Base error class for all dot-steward errors
 */
export class DotStewardError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class ConfigurationError extends DotStewardError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "CONFIGURATION_ERROR", context);
  }
}

/**
 * Error thrown when a plugin fails to load or initialize
 */
export class PluginError extends DotStewardError {
  constructor(
    message: string,
    public readonly pluginKey: string,
    context?: Record<string, unknown>,
  ) {
    super(message, "PLUGIN_ERROR", { ...context, pluginKey });
  }
}

/**
 * Error thrown when plugin discovery fails
 */
export class PluginDiscoveryError extends PluginError {
  constructor(pluginKey: string, reason: string, context?: Record<string, unknown>) {
    super(`Failed to discover plugin '${pluginKey}': ${reason}`, pluginKey, context);
    this.code = "PLUGIN_DISCOVERY_ERROR";
  }
}

/**
 * Error thrown when a dependency cycle is detected
 */
export class DependencyCycleError extends DotStewardError {
  constructor(
    public readonly cycle: string[],
    context?: Record<string, unknown>,
  ) {
    super(`Dependency cycle detected: ${cycle.join(" -> ")}`, "DEPENDENCY_CYCLE", {
      ...context,
      cycle,
    });
  }
}

/**
 * Error thrown when item validation fails
 */
export class ValidationError extends DotStewardError {
  constructor(
    message: string,
    public readonly itemId?: string,
    context?: Record<string, unknown>,
  ) {
    super(message, "VALIDATION_ERROR", { ...context, itemId });
  }
}

/**
 * Error thrown when an apply operation fails
 */
export class ApplyError extends DotStewardError {
  constructor(
    message: string,
    public readonly itemId: string,
    public readonly phase: "probe" | "apply" | "validate",
    context?: Record<string, unknown>,
  ) {
    super(message, "APPLY_ERROR", { ...context, itemId, phase });
  }
}

/**
 * Error thrown when state management fails
 */
export class StateError extends DotStewardError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "STATE_ERROR", context);
  }
}

/**
 * Error thrown when file operations fail
 */
export class FileSystemError extends DotStewardError {
  constructor(
    message: string,
    public readonly path: string,
    public readonly operation: "read" | "write" | "delete" | "access",
    context?: Record<string, unknown>,
  ) {
    super(message, "FILESYSTEM_ERROR", { ...context, path, operation });
  }
}

/**
 * Error thrown when input validation fails
 */
export class InputValidationError extends DotStewardError {
  constructor(
    message: string,
    public readonly field: string,
    context?: Record<string, unknown>,
  ) {
    super(message, "INPUT_VALIDATION_ERROR", { ...context, field });
  }
}

/**
 * Error thrown when a required dependency is missing
 */
export class MissingDependencyError extends DotStewardError {
  constructor(
    public readonly dependency: string,
    context?: Record<string, unknown>,
  ) {
    super(`Missing required dependency: ${dependency}`, "MISSING_DEPENDENCY", {
      ...context,
      dependency,
    });
  }
}

/**
 * Error thrown when an operation times out
 */
export class TimeoutError extends DotStewardError {
  constructor(
    message: string,
    public readonly timeoutMs: number,
    context?: Record<string, unknown>,
  ) {
    super(message, "TIMEOUT_ERROR", { ...context, timeoutMs });
  }
}

/**
 * Error thrown when attempting an unsupported operation
 */
export class UnsupportedOperationError extends DotStewardError {
  constructor(
    message: string,
    public readonly operation: string,
    context?: Record<string, unknown>,
  ) {
    super(message, "UNSUPPORTED_OPERATION", { ...context, operation });
  }
}

/**
 * Error thrown when privilege escalation is required but not available
 */
export class PrivilegeError extends DotStewardError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "PRIVILEGE_ERROR", context);
  }
}

/**
 * Utility function to check if an error is a DotStewardError
 */
export function isDotStewardError(error: unknown): error is DotStewardError {
  return error instanceof DotStewardError;
}

/**
 * Utility function to wrap unknown errors
 */
export function wrapError(error: unknown, message: string, code = "UNKNOWN_ERROR"): DotStewardError {
  if (isDotStewardError(error)) {
    return error;
  }

  const context: Record<string, unknown> = {};

  if (error instanceof Error) {
    context.originalError = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  } else {
    context.originalError = error;
  }

  return new DotStewardError(message, code, context);
}

/**
 * Utility function to format error for display
 */
export function formatError(error: unknown): string {
  if (isDotStewardError(error)) {
    let formatted = `[${error.code}] ${error.message}`;
    if (error.context && Object.keys(error.context).length > 0) {
      formatted += `\nContext: ${JSON.stringify(error.context, null, 2)}`;
    }
    return formatted;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
