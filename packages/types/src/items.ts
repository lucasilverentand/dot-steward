import type { ManagedItemId } from "./ids";

// Managed items
export type ManagedItemKind =
  | "package"
  | "file"
  | "dir"
  | "service"
  | "env"
  | "secret"
  // Allow extension by plugins without changing the core union
  | (string & {});

export interface ManagedItem<TSpec = unknown> {
  id: ManagedItemId;
  kind: ManagedItemKind;
  spec: TSpec;
  deps?: ManagedItemId[];
  owner?: string;
  metadata?: Record<string, unknown>;
}
