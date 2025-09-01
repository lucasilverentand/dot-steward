import { AptItem } from "@dot-steward/apt";
import { BrewCask, BrewFormula, BrewTap } from "@dot-steward/brew";
import { CommandItem } from "@dot-steward/command";
import { OS, z } from "@dot-steward/core";
import { FileDir, FileEnsure, FileSymlink } from "@dot-steward/file";
import { ShellAlias, ShellEnvVar, ShellPath } from "@dot-steward/shell";

export {
  OS,
  CommandItem,
  AptItem,
  BrewFormula,
  BrewTap,
  BrewCask,
  FileEnsure,
  FileDir,
  FileSymlink,
  ShellEnvVar,
  ShellAlias,
  ShellPath,
};

export const Item = z.discriminatedUnion("module", [
  CommandItem,
  AptItem,
  BrewFormula,
  BrewTap,
  BrewCask,
  FileEnsure,
  FileDir,
  FileSymlink,
  ShellEnvVar,
  ShellAlias,
  ShellPath,
]);
export type Item = z.infer<typeof Item>;

export * as apt from "@dot-steward/apt";
export * as brew from "@dot-steward/brew";
export * as command from "@dot-steward/command";
export * as file from "@dot-steward/file";
export * as shell from "@dot-steward/shell";

export interface Match {
  os?: OS;
  hostname?: string | string[];
  user?: string;
}

export interface Profile {
  id: string;
  match?: Match;
  include?: string[];
  items: Item[];
}

export function profile(id: string, data: Omit<Profile, "id">): Profile {
  return { id, ...data, items: data.items ?? [] };
}

export interface Plan {
  profiles: Profile[];
}

export function plan(p: Plan): Plan {
  return p;
}

export async function prepare(plan: Plan): Promise<Item[]> {
  const mods = new Set(
    plan.profiles.flatMap((profile) => profile.items.map((item) => item.module)),
  );
  const items: Item[] = [];
  for (const mod of mods) {
    try {
      const m: unknown = await import(`@dot-steward/${mod}`);
      const fn = (m as { prepare?: () => Item[] }).prepare;
      if (typeof fn === "function") items.push(...fn());
    } catch {
      // ignore modules that cannot be loaded
    }
  }
  return items;
}
