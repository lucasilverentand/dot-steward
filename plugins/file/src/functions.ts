import type { Dir, Ensure, Symlink } from "./items";

type EnsureInput = Omit<Ensure, "plugin" | "kind">;
type DirInput = Omit<Dir, "plugin" | "kind">;
type SymlinkInput = Omit<Symlink, "plugin" | "kind">;

export function ensure(id: string, path: string, content?: string): Ensure;
export function ensure(input: EnsureInput): Ensure;
export function ensure(
  idOrInput: string | EnsureInput,
  path?: string,
  content = "",
): Ensure {
  if (typeof idOrInput === "string") {
    if (!path) throw new Error("path is required");
    return {
      plugin: "file",
      kind: "ensure",
      id: idOrInput,
      path,
      content,
    };
  }
  return {
    plugin: "file",
    kind: "ensure",
    ...idOrInput,
    content: idOrInput.content ?? "",
  };
}

export function dir(id: string, path: string): Dir;
export function dir(input: DirInput): Dir;
export function dir(idOrInput: string | DirInput, path?: string): Dir {
  if (typeof idOrInput === "string") {
    if (!path) throw new Error("path is required");
    return { plugin: "file", kind: "dir", id: idOrInput, path };
  }
  return { plugin: "file", kind: "dir", ...idOrInput };
}

export function symlink(id: string, path: string, target: string): Symlink;
export function symlink(input: SymlinkInput): Symlink;
export function symlink(
  idOrInput: string | SymlinkInput,
  path?: string,
  target?: string,
): Symlink {
  if (typeof idOrInput === "string") {
    if (!path || !target) throw new Error("path and target are required");
    return { plugin: "file", kind: "symlink", id: idOrInput, path, target };
  }
  return { plugin: "file", kind: "symlink", ...idOrInput };
}
