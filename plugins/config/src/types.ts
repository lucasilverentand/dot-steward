// JSON-compatible value tree used as the universal config shape
export type ConfigPrimitive = string | number | boolean | null;
export type ConfigValue =
  | ConfigPrimitive
  | ConfigValue[]
  | { [key: string]: ConfigValue };

// Runtime validator for ConfigValue (minimal, recursive)
export function isConfigValue(value: unknown): value is ConfigValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every((v) => isConfigValue(v));
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      if (!isConfigValue(v)) return false;
    }
    return true;
  }
  return false;
}

export type Format = "json" | "yaml" | "toml";
