// Plugin contracts (manifests and readiness)
import type { ManagedItemKind } from "./items";

export interface ReadinessCheck {
  name: string;
  ok: boolean;
  details?: string;
}

export interface PluginReadiness {
  status: "ready" | "not_ready" | "error";
  checks?: ReadinessCheck[];
}

export interface PluginCapability {
  id: string; // capability identifier
  provides: ManagedItemKind[] | (string & {})[];
  description?: string;
}

export interface SetupRequirement {
  id: string;
  description?: string;
  optional?: boolean;
}

export interface PluginManifest {
  id: string;
  version?: string;
  description?: string;
  capabilities: PluginCapability[];
  setupRequirements?: SetupRequirement[];
  policies?: string[];
}
