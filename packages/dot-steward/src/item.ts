import { z } from "@dot-steward/core";
import { AptItem } from "@dot-steward/apt";
import { BrewItem } from "@dot-steward/brew";
import { CommandItem } from "@dot-steward/command";
import { FileItem } from "@dot-steward/file";
import { ShellItem } from "@dot-steward/shell";

export const Item = z.union([
  CommandItem,
  AptItem,
  BrewItem,
  FileItem,
  ShellItem,
]);
export type Item = z.infer<typeof Item>;
