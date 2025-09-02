export interface Env {
  id: string;
  plugin: "shell";
  kind: "env";
  key: string;
  value: string;
}
export interface Alias {
  id: string;
  plugin: "shell";
  kind: "alias";
  name: string;
  command: string;
}
export interface PathItem {
  id: string;
  plugin: "shell";
  kind: "path";
  dir: string;
}

export type ShellItem = Env | Alias | PathItem;

export type Shell = "bash" | "zsh" | "sh";
