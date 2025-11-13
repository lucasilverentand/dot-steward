import { describe, test, expect } from "bun:test";
import {
  DotStewardError,
  ConfigurationError,
  PluginError,
  PluginDiscoveryError,
  DependencyCycleError,
  ValidationError,
  ApplyError,
  StateError,
  FileSystemError,
  InputValidationError,
  MissingDependencyError,
  TimeoutError,
  UnsupportedOperationError,
  PrivilegeError,
  isDotStewardError,
  wrapError,
  formatError,
} from "../errors.ts";

describe("errors.ts - Error Classes", () => {
  describe("DotStewardError", () => {
    test("should create error with message and code", () => {
      const error = new DotStewardError("Test message", "TEST_CODE");

      expect(error.message).toBe("Test message");
      expect(error.code).toBe("TEST_CODE");
      expect(error.name).toBe("DotStewardError");
    });

    test("should include context", () => {
      const context = { foo: "bar", baz: 123 };
      const error = new DotStewardError("Test", "CODE", context);

      expect(error.context).toEqual(context);
    });

    test("should serialize to JSON", () => {
      const error = new DotStewardError("Test", "CODE", { key: "value" });
      const json = error.toJSON();

      expect(json.name).toBe("DotStewardError");
      expect(json.message).toBe("Test");
      expect(json.code).toBe("CODE");
      expect(json.context).toEqual({ key: "value" });
      expect(json.stack).toBeDefined();
    });
  });

  describe("ConfigurationError", () => {
    test("should create configuration error", () => {
      const error = new ConfigurationError("Invalid config");

      expect(error.message).toBe("Invalid config");
      expect(error.code).toBe("CONFIGURATION_ERROR");
      expect(error.name).toBe("ConfigurationError");
    });
  });

  describe("PluginError", () => {
    test("should create plugin error with plugin key", () => {
      const error = new PluginError("Plugin failed", "my-plugin");

      expect(error.message).toBe("Plugin failed");
      expect(error.pluginKey).toBe("my-plugin");
      expect(error.code).toBe("PLUGIN_ERROR");
      expect(error.context?.pluginKey).toBe("my-plugin");
    });
  });

  describe("PluginDiscoveryError", () => {
    test("should create discovery error with formatted message", () => {
      const error = new PluginDiscoveryError("test-plugin", "not found");

      expect(error.message).toBe("Failed to discover plugin 'test-plugin': not found");
      expect(error.pluginKey).toBe("test-plugin");
      expect(error.code).toBe("PLUGIN_DISCOVERY_ERROR");
    });
  });

  describe("DependencyCycleError", () => {
    test("should create cycle error with cycle path", () => {
      const cycle = ["a", "b", "c", "a"];
      const error = new DependencyCycleError(cycle);

      expect(error.message).toBe("Dependency cycle detected: a -> b -> c -> a");
      expect(error.cycle).toEqual(cycle);
      expect(error.code).toBe("DEPENDENCY_CYCLE");
    });
  });

  describe("ValidationError", () => {
    test("should create validation error with item id", () => {
      const error = new ValidationError("Validation failed", "item-123");

      expect(error.message).toBe("Validation failed");
      expect(error.itemId).toBe("item-123");
      expect(error.context?.itemId).toBe("item-123");
    });
  });

  describe("ApplyError", () => {
    test("should create apply error with item id and phase", () => {
      const error = new ApplyError("Apply failed", "item-123", "apply");

      expect(error.message).toBe("Apply failed");
      expect(error.itemId).toBe("item-123");
      expect(error.phase).toBe("apply");
      expect(error.context?.itemId).toBe("item-123");
      expect(error.context?.phase).toBe("apply");
    });
  });

  describe("FileSystemError", () => {
    test("should create filesystem error with path and operation", () => {
      const error = new FileSystemError("Cannot read file", "/test/file.txt", "read");

      expect(error.message).toBe("Cannot read file");
      expect(error.path).toBe("/test/file.txt");
      expect(error.operation).toBe("read");
    });
  });

  describe("InputValidationError", () => {
    test("should create input validation error with field", () => {
      const error = new InputValidationError("Invalid input", "email");

      expect(error.message).toBe("Invalid input");
      expect(error.field).toBe("email");
    });
  });

  describe("MissingDependencyError", () => {
    test("should create missing dependency error", () => {
      const error = new MissingDependencyError("required-package");

      expect(error.message).toBe("Missing required dependency: required-package");
      expect(error.dependency).toBe("required-package");
    });
  });

  describe("TimeoutError", () => {
    test("should create timeout error with duration", () => {
      const error = new TimeoutError("Operation timed out", 5000);

      expect(error.message).toBe("Operation timed out");
      expect(error.timeoutMs).toBe(5000);
    });
  });

  describe("UnsupportedOperationError", () => {
    test("should create unsupported operation error", () => {
      const error = new UnsupportedOperationError("Not supported", "feature-x");

      expect(error.message).toBe("Not supported");
      expect(error.operation).toBe("feature-x");
    });
  });

  describe("PrivilegeError", () => {
    test("should create privilege error", () => {
      const error = new PrivilegeError("Requires sudo");

      expect(error.message).toBe("Requires sudo");
      expect(error.code).toBe("PRIVILEGE_ERROR");
    });
  });

  describe("isDotStewardError", () => {
    test("should identify DotStewardError instances", () => {
      const error = new DotStewardError("Test", "CODE");
      expect(isDotStewardError(error)).toBe(true);
    });

    test("should identify subclass instances", () => {
      const error = new ConfigurationError("Test");
      expect(isDotStewardError(error)).toBe(true);
    });

    test("should return false for regular errors", () => {
      const error = new Error("Test");
      expect(isDotStewardError(error)).toBe(false);
    });

    test("should return false for non-errors", () => {
      expect(isDotStewardError("string")).toBe(false);
      expect(isDotStewardError(123)).toBe(false);
      expect(isDotStewardError(null)).toBe(false);
      expect(isDotStewardError(undefined)).toBe(false);
    });
  });

  describe("wrapError", () => {
    test("should return DotStewardError as-is", () => {
      const original = new ConfigurationError("Test");
      const wrapped = wrapError(original, "Wrapper");

      expect(wrapped).toBe(original);
    });

    test("should wrap regular Error", () => {
      const original = new Error("Original message");
      const wrapped = wrapError(original, "Wrapped message");

      expect(wrapped.message).toBe("Wrapped message");
      expect(wrapped.code).toBe("UNKNOWN_ERROR");
      expect(wrapped.context?.originalError).toBeDefined();
    });

    test("should wrap non-Error values", () => {
      const wrapped = wrapError("string error", "Wrapped");

      expect(wrapped.message).toBe("Wrapped");
      expect(wrapped.context?.originalError).toBe("string error");
    });

    test("should use custom error code", () => {
      const wrapped = wrapError(new Error("Test"), "Wrapped", "CUSTOM_CODE");

      expect(wrapped.code).toBe("CUSTOM_CODE");
    });
  });

  describe("formatError", () => {
    test("should format DotStewardError with context", () => {
      const error = new ConfigurationError("Test message", { key: "value" });
      const formatted = formatError(error);

      expect(formatted).toContain("[CONFIGURATION_ERROR]");
      expect(formatted).toContain("Test message");
      expect(formatted).toContain("Context:");
      expect(formatted).toContain('"key": "value"');
    });

    test("should format DotStewardError without context", () => {
      const error = new ConfigurationError("Test message");
      const formatted = formatError(error);

      expect(formatted).toBe("[CONFIGURATION_ERROR] Test message");
    });

    test("should format regular Error", () => {
      const error = new Error("Test message");
      const formatted = formatError(error);

      expect(formatted).toBe("Test message");
    });

    test("should format non-Error values", () => {
      expect(formatError("string error")).toBe("string error");
      expect(formatError(123)).toBe("123");
      expect(formatError(null)).toBe("null");
    });
  });
});
