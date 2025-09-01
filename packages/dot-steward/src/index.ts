import { z, OS } from "@dot-steward/core";
import { CommandItem } from "@dot-steward/command";
import { AptItem } from "@dot-steward/apt";
import { BrewFormula, BrewTap, BrewCask } from "@dot-steward/brew";
import { FileEnsure, FileDir, FileSymlink } from "@dot-steward/file";
import { ShellEnvVar, ShellAlias, ShellPath } from "@dot-steward/shell";

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

export * as command from "@dot-steward/command";
export * as apt from "@dot-steward/apt";
export * as brew from "@dot-steward/brew";
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
