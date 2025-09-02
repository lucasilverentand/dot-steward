import type { HostFacts, Profile } from "@dot-steward/types";
import type { ManagerConfig } from "./types";

// Simple helpers to define profiles and configs in a concise, typed way

export function defineProfile(
  name: string,
  init: Partial<Omit<Profile, "name">> = {},
): Profile {
  return {
    name,
    priority: init.priority ?? 0,
    variables: init.variables ?? {},
    includes: init.includes ?? [],
    apps: init.apps ?? [],
    items: init.items ?? [],
    matcher: init.matcher,
  } satisfies Profile;
}

export function defineProfiles(...list: Profile[]): Profile[] {
  return list;
}

export function defineConfig(input: {
  profiles: Profile[];
  host?: Partial<HostFacts>;
  plugins?: import("@dot-steward/types").Plugin[];
}): ManagerConfig {
  return { profiles: input.profiles, host: input.host, plugins: input.plugins };
}

// New concise API: profile() and config()
export function profile(
  name: string,
  init: Partial<Omit<Profile, "name">> = {},
): Profile {
  return defineProfile(name, init);
}

export function profiles(...list: Profile[]): Profile[] {
  return defineProfiles(...list);
}

export function config(input: {
  profiles: Profile[];
  host?: Partial<HostFacts>;
  plugins?: import("@dot-steward/types").Plugin[];
}): ManagerConfig {
  return defineConfig(input);
}

export class ConfigBuilder {
  private _profiles: Profile[] = [];
  private _host?: Partial<HostFacts>;
  private _plugins: import("@dot-steward/types").Plugin[] = [];

  static create(): ConfigBuilder {
    return new ConfigBuilder();
  }

  withHost(host: Partial<HostFacts>): this {
    this._host = { ...(this._host ?? {}), ...host };
    return this;
  }

  addProfile(profile: Profile): this {
    this._profiles.push(profile);
    return this;
  }

  addProfiles(profiles: Profile[]): this {
    this._profiles.push(...profiles);
    return this;
  }

  withPlugins(plugins: import("@dot-steward/types").Plugin[]): this {
    this._plugins.push(...plugins);
    return this;
  }

  build(): ManagerConfig {
    return {
      profiles: this._profiles,
      host: this._host,
      plugins: this._plugins,
    };
  }
}
