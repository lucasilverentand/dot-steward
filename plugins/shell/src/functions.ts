import type { Alias, Env, PathItem } from "./items";

type EnvInput = Omit<Env, "plugin" | "kind">;
type AliasInput = Omit<Alias, "plugin" | "kind">;
type PathInput = Omit<PathItem, "plugin" | "kind">;

export function env(id: string, key: string, value: string): Env;
export function env(input: EnvInput): Env;
export function env(
  idOrInput: string | EnvInput,
  key?: string,
  value?: string,
): Env {
  if (typeof idOrInput === "string") {
    if (!key || !value) throw new Error("key and value are required");
    return { plugin: "shell", kind: "env", id: idOrInput, key, value };
  }
  return { plugin: "shell", kind: "env", ...idOrInput };
}

export function alias(id: string, name: string, command: string): Alias;
export function alias(input: AliasInput): Alias;
export function alias(
  idOrInput: string | AliasInput,
  name?: string,
  command?: string,
): Alias {
  if (typeof idOrInput === "string") {
    if (!name || !command) throw new Error("name and command are required");
    return { plugin: "shell", kind: "alias", id: idOrInput, name, command };
  }
  return { plugin: "shell", kind: "alias", ...idOrInput };
}

export function path(id: string, dir: string): PathItem;
export function path(input: PathInput): PathItem;
export function path(idOrInput: string | PathInput, dir?: string): PathItem {
  if (typeof idOrInput === "string") {
    if (!dir) throw new Error("dir is required");
    return { plugin: "shell", kind: "path", id: idOrInput, dir };
  }
  return { plugin: "shell", kind: "path", ...idOrInput };
}
