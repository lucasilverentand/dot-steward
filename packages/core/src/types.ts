import type { HostFacts, Profile } from "@dot-steward/types";
import type { Plugin } from "@dot-steward/types";

export interface ManagerConfig {
  profiles: Profile[];
  host?: Partial<HostFacts>;
  plugins?: Plugin[];
}

export interface ManagerOptions {
  engine?: { name?: string; version?: string };
  plugins?: Plugin[];
}
