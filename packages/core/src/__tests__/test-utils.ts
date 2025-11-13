import { expect } from "bun:test";
import type { Plugin, PluginFactory, Item, HostContext } from "../index.ts";

/**
 * Create a mock host context for testing
 */
export function createMockHostContext(overrides?: Partial<HostContext>): HostContext {
  return {
    platform: "darwin",
    arch: "arm64",
    hostname: "test-machine",
    username: "testuser",
    home: "/home/testuser",
    shell: "/bin/bash",
    env: {},
    ...overrides,
  };
}

/**
 * Create a mock plugin for testing
 */
export function createMockPlugin(
  key: string,
  overrides?: Partial<Plugin<unknown>>,
): Plugin<unknown> {
  return {
    plugin_key: key,
    name: `Test Plugin ${key}`,
    version: "1.0.0",

    async analyze() {
      return [];
    },

    async plan() {
      return [];
    },

    async apply() {
      return { success: true };
    },

    ...overrides,
  };
}

/**
 * Create a mock plugin factory for testing
 */
export function createMockPluginFactory(
  key: string,
  plugin?: Partial<Plugin<unknown>>,
): PluginFactory {
  return () => createMockPlugin(key, plugin);
}

/**
 * Create a mock item for testing
 */
export function createMockItem<T = unknown>(
  id: string,
  overrides?: Partial<Item<T>>,
): Item<T> {
  return {
    id,
    plugin_key: "test",
    data: {} as T,
    depends_on: [],

    async probe() {
      return { current_state: "unknown" };
    },

    async apply() {
      return { success: true };
    },

    async validate() {
      return { valid: true };
    },

    dedupe_key() {
      return id;
    },

    ...overrides,
  };
}

/**
 * Helper to assert that a function throws an error
 */
export async function expectToThrow(
  fn: () => Promise<unknown> | unknown,
  errorMatcher?: string | RegExp | ((error: Error) => boolean),
): Promise<void> {
  let thrown = false;
  let caughtError: Error | undefined;

  try {
    const result = fn();
    if (result instanceof Promise) {
      await result;
    }
  } catch (error) {
    thrown = true;
    caughtError = error as Error;
  }

  expect(thrown).toBe(true);

  if (errorMatcher && caughtError) {
    if (typeof errorMatcher === "string") {
      expect(caughtError.message).toContain(errorMatcher);
    } else if (errorMatcher instanceof RegExp) {
      expect(caughtError.message).toMatch(errorMatcher);
    } else {
      expect(errorMatcher(caughtError)).toBe(true);
    }
  }
}

/**
 * Helper to create a spy function
 */
export function createSpy<T extends (...args: unknown[]) => unknown>(): {
  fn: T;
  calls: unknown[][];
  callCount: number;
} {
  const calls: unknown[][] = [];

  const fn = ((...args: unknown[]) => {
    calls.push(args);
    return undefined;
  }) as T;

  return {
    fn,
    calls,
    get callCount() {
      return calls.length;
    },
  };
}

/**
 * Helper to wait for a condition
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 1000,
  intervalMs = 50,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const result = await condition();
    if (result) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Condition not met within ${timeoutMs}ms`);
}
