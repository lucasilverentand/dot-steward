import { Base, z } from "@dot-steward/core";

export const ShellEnvVar = Base.extend({
  module: z.literal("shell"),
  kind: z.literal("env"),
  key: z.string(),
  value: z.string(),
});
export const ShellAlias = Base.extend({
  module: z.literal("shell"),
  kind: z.literal("alias"),
  name: z.string(),
  command: z.string(),
});
export const ShellPath = Base.extend({
  module: z.literal("shell"),
  kind: z.literal("path"),
  dir: z.string(),
});

export type Env = z.infer<typeof ShellEnvVar>;
export type Alias = z.infer<typeof ShellAlias>;
export type PathItem = z.infer<typeof ShellPath>;

type EnvInput = Omit<Env, "module" | "kind">;
type AliasInput = Omit<Alias, "module" | "kind">;
type PathInput = Omit<PathItem, "module" | "kind">;

export function env(id: string, key: string, value: string): Env;
export function env(input: EnvInput): Env;
export function env(
  idOrInput: string | EnvInput,
  key?: string,
  value?: string,
): Env {
  if (typeof idOrInput === "string") {
    if (!key || !value) throw new Error("key and value are required");
    return { module: "shell", kind: "env", id: idOrInput, key, value };
  }
  return { module: "shell", kind: "env", ...idOrInput };
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
    return { module: "shell", kind: "alias", id: idOrInput, name, command };
  }
  return { module: "shell", kind: "alias", ...idOrInput };
}

export function path(id: string, dir: string): PathItem;
export function path(input: PathInput): PathItem;
export function path(idOrInput: string | PathInput, dir?: string): PathItem {
  if (typeof idOrInput === "string") {
    if (!dir) throw new Error("dir is required");
    return { module: "shell", kind: "path", id: idOrInput, dir };
  }
  return { module: "shell", kind: "path", ...idOrInput };
}
