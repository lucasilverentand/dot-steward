import { z } from "@dot-steward/core";
import { AptItem } from "@dot-steward/apt";
import { BrewCask, BrewFormula, BrewTap } from "@dot-steward/brew";
import { CommandItem } from "@dot-steward/command";
import { FileDir, FileEnsure, FileSymlink } from "@dot-steward/file";
import { ShellAlias, ShellEnvVar, ShellPath } from "@dot-steward/shell";

export const Item = z.discriminatedUnion("plugin", [
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
