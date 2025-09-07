import type { z } from "zod";

// Core types used across the macOS settings plugin

export type WriteType = "-bool" | "-int" | "-float" | "-string";

export type Rule = {
  path: string[]; // e.g. ["dock","autohide"]
  domain: string;
  key: string;
  type: WriteType;
  opts?: { global?: boolean; currentHost?: boolean };
  // Map the input value to a string suitable for defaults
  map?: (value: unknown) => string;
  // Name of process to restart (killall), e.g. "Dock"
  restart?: string;
};

// Catalog rules allow referencing settings by ALL.md category/key names
export type CatalogRule = {
  domains: string[]; // most are single domain; some apply to multiple
  key: string;
  type: WriteType;
  opts?: { global?: boolean; currentHost?: boolean };
  restart?: string;
  map?: (value: unknown) => string;
};

// Forward type reference helpers
export type ZodInfer<T extends z.ZodTypeAny> = z.infer<T>;
