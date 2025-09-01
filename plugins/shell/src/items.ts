import { Base, z } from "@dot-steward/core";

export const ShellEnvVar = Base.extend({
  plugin: z.literal("shell"),
  kind: z.literal("env"),
  key: z.string(),
  value: z.string(),
});
export const ShellAlias = Base.extend({
  plugin: z.literal("shell"),
  kind: z.literal("alias"),
  name: z.string(),
  command: z.string(),
});
export const ShellPath = Base.extend({
  plugin: z.literal("shell"),
  kind: z.literal("path"),
  dir: z.string(),
});

export type Env = z.infer<typeof ShellEnvVar>;
export type Alias = z.infer<typeof ShellAlias>;
export type PathItem = z.infer<typeof ShellPath>;

export const ShellItem = z.discriminatedUnion("kind", [
  ShellEnvVar,
  ShellAlias,
  ShellPath,
]);
export type ShellItem = z.infer<typeof ShellItem>;

export type Shell = "bash" | "zsh" | "sh";
