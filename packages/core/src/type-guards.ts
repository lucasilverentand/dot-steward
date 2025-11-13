/**
 * Type guards and runtime type checking utilities
 */

import type { Plugin } from "./plugin.ts";
import type { Item } from "./item.ts";

/**
 * Check if an unknown value has a property
 */
export function hasProperty<K extends string>(
  obj: unknown,
  key: K,
): obj is Record<K, unknown> {
  return typeof obj === "object" && obj !== null && key in obj;
}

/**
 * Check if value is a Plugin instance
 */
export function isPlugin(value: unknown): value is Plugin<unknown> {
  return value instanceof Object && "plugin_key" in value && "name" in value && "version" in value;
}

/**
 * Check if value is an Item instance
 */
export function isItem(value: unknown): value is Item<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "plugin_key" in value &&
    typeof (value as { probe?: unknown }).probe === "function" &&
    typeof (value as { apply?: unknown }).apply === "function"
  );
}

/**
 * Safe type guard for objects with plugin property
 */
export function hasPluginProperty(
  value: unknown,
): value is { plugin: Plugin<unknown> } {
  return (
    typeof value === "object" &&
    value !== null &&
    "plugin" in value &&
    isPlugin((value as { plugin: unknown }).plugin)
  );
}

/**
 * Safe type guard for objects with plugin_key property
 */
export function hasPluginKey(value: unknown): value is { plugin_key: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "plugin_key" in value &&
    typeof (value as { plugin_key: unknown }).plugin_key === "string"
  );
}

/**
 * Safe type guard for objects with get_plugin_factory method
 */
export function hasPluginFactory(
  value: unknown,
): value is { get_plugin_factory: () => Plugin<unknown> } {
  return (
    typeof value === "object" &&
    value !== null &&
    "get_plugin_factory" in value &&
    typeof (value as { get_plugin_factory: unknown }).get_plugin_factory === "function"
  );
}

/**
 * Safe type guard for objects with get_used_plugins method
 */
export function hasUsedPlugins(
  value: unknown,
): value is {
  get_used_plugins: () => Array<{ key: string; get_plugin_factory: () => Plugin<unknown> }>;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "get_used_plugins" in value &&
    typeof (value as { get_used_plugins: unknown }).get_used_plugins === "function"
  );
}

/**
 * Safe type guard for objects with dedupe_key method
 */
export function hasDedupeKey(value: unknown): value is { dedupe_key: () => string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "dedupe_key" in value &&
    typeof (value as { dedupe_key: unknown }).dedupe_key === "function"
  );
}

/**
 * Safe type guard for objects with name property
 */
export function hasName(value: unknown): value is { name: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof (value as { name: unknown }).name === "string"
  );
}

/**
 * Safe type guard for AggregateError
 */
export function isAggregateError(error: unknown): error is AggregateError {
  return (
    error instanceof Error &&
    "errors" in error &&
    Array.isArray((error as { errors: unknown }).errors)
  );
}

/**
 * Safe getter for plugin name from a Plugin instance
 */
export function getPluginName(plugin: unknown): string | undefined {
  if (!isPlugin(plugin)) return undefined;
  return hasName(plugin) ? plugin.name : undefined;
}

/**
 * Safe getter for plugin key from an item
 */
export function getItemPluginKey(item: unknown): string | undefined {
  if (!hasPluginKey(item)) return undefined;
  return item.plugin_key;
}

/**
 * Extract configuration profiles from raw config data
 */
export interface ProfileLike {
  kind?: string;
  name: string;
  items: Item<unknown>[];
}

export function isProfileArray(value: unknown): value is ProfileLike[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return true;

  const first = value[0];
  return (
    typeof first === "object" &&
    first !== null &&
    "kind" in first &&
    first.kind === "profile"
  );
}

/**
 * Check if value has crypto.randomUUID
 */
export function hasCryptoRandomUUID(
  value: unknown,
): value is { crypto: { randomUUID: () => string } } {
  return (
    typeof value === "object" &&
    value !== null &&
    "crypto" in value &&
    typeof (value as { crypto: unknown }).crypto === "object" &&
    (value as { crypto: unknown }).crypto !== null &&
    "randomUUID" in (value as { crypto: object }).crypto &&
    typeof (value as { crypto: { randomUUID: unknown } }).crypto.randomUUID === "function"
  );
}

/**
 * Safe type guard for process.stdout with columns
 */
export function hasColumns(value: unknown): value is { columns: number; isTTY?: boolean } {
  return (
    typeof value === "object" &&
    value !== null &&
    "columns" in value &&
    typeof (value as { columns: unknown }).columns === "number"
  );
}
