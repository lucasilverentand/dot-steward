import { ensure } from "@dot-steward/file";
import type { Ensure } from "@dot-steward/file/src/items";
import YAML from "yaml";
import TOML from "@iarna/toml";
import { isConfigValue, type ConfigValue, type Format } from "./types";

function toYAML(value: ConfigValue): string {
  return YAML.stringify(
    value as unknown as Parameters<typeof YAML.stringify>[0],
  );
}

function toTOML(value: ConfigValue): string {
  return TOML.stringify(
    value as unknown as Parameters<typeof TOML.stringify>[0],
  );
}

export interface JsonOptions {
  indent?: number;
}

export class ConfigDoc<T extends ConfigValue = ConfigValue> {
  constructor(readonly value: T) {
    // Validate at construction for early feedback
    if (!isConfigValue(value)) {
      throw new Error("Invalid ConfigValue: must be JSON-compatible");
    }
  }

  asJSON(options: JsonOptions = {}): string {
    const indent = options.indent ?? 2;
    return JSON.stringify(this.value, null, indent);
  }

  asYAML(): string {
    return toYAML(this.value);
  }

  asTOML(): string {
    return toTOML(this.value);
  }

  serialize(format: Format, jsonOptions?: JsonOptions): string {
    if (format === "json") return this.asJSON(jsonOptions);
    if (format === "yaml") return this.asYAML();
    return this.asTOML();
  }

  toFile(
    id: string,
    path: string,
    format: Format,
    jsonOptions?: JsonOptions,
  ): Ensure {
    const content = this.serialize(format, jsonOptions);
    return ensure(id, path, content);
  }
}

export function config<T extends ConfigValue>(value: T): ConfigDoc<T> {
  return new ConfigDoc(value);
}

export function serialize(
  value: ConfigValue,
  format: Format,
  jsonOptions?: JsonOptions,
): string {
  return new ConfigDoc(value).serialize(format, jsonOptions);
}
