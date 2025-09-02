export interface Command {
  id: string;
  plugin: "command";
  kind: "cmd";
  check: string;
  apply: string;
}
