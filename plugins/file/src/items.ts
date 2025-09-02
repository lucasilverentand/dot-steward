export interface Ensure {
  id: string;
  plugin: "file";
  kind: "ensure";
  path: string;
  content: string;
}
export interface Dir {
  id: string;
  plugin: "file";
  kind: "dir";
  path: string;
}
export interface Symlink {
  id: string;
  plugin: "file";
  kind: "symlink";
  path: string;
  target: string;
}

export type FileItem = Ensure | Dir | Symlink;
