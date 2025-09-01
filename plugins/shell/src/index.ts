import { Base, Plugin, z } from "@dot-steward/core";

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

function quote(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

export class ShellConfig {
  private envVars = new Map<string, string>();
  private aliases = new Map<string, string>();
  private paths: string[] = [];

  collect(item: ShellItem): void {
    if (item.kind === "env") {
      this.envVars.set(item.key, item.value);
    } else if (item.kind === "alias") {
      this.aliases.set(item.name, item.command);
    } else if (item.kind === "path") {
      this.paths.push(item.dir);
    }
  }

  render(_shell: Shell): string {
    const lines: string[] = [];
    for (const [key, value] of this.envVars) {
      lines.push(`export ${key}=${quote(value)}`);
    }
    if (this.paths.length > 0) {
      const joined = this.paths.join(":");
      lines.push(`export PATH=${quote(`${joined}:$PATH`)}`);
    }
    for (const [name, command] of this.aliases) {
      const escaped = command.replace(/'/g, "'\\''");
      lines.push(`alias ${name}='${escaped}'`);
    }
    return lines.join("\n");
  }

  renderAll(): Record<Shell, string> {
    return {
      bash: this.render("bash"),
      zsh: this.render("zsh"),
      sh: this.render("sh"),
    };
  }
}

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

export class ShellPlugin extends Plugin<ShellItem> {
  name = "shell";
  schema = ShellItem;
}

export const plugin = new ShellPlugin();
