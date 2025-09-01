import { z, Base } from "@dot-steward/core";

export const FileEnsure = Base.extend({
  module: z.literal("file"),
  kind: z.literal("ensure"),
  path: z.string(),
  content: z.string().default(""),
});
export const FileDir = Base.extend({
  module: z.literal("file"),
  kind: z.literal("dir"),
  path: z.string(),
});
export const FileSymlink = Base.extend({
  module: z.literal("file"),
  kind: z.literal("symlink"),
  path: z.string(),
  target: z.string(),
});

export type Ensure = z.infer<typeof FileEnsure>;
export type Dir = z.infer<typeof FileDir>;
export type Symlink = z.infer<typeof FileSymlink>;

type EnsureInput = Omit<Ensure, "module" | "kind">;
type DirInput = Omit<Dir, "module" | "kind">;
type SymlinkInput = Omit<Symlink, "module" | "kind">;

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
      module: "file",
      kind: "ensure",
      id: idOrInput,
      path,
      content,
    };
  }
  return {
    module: "file",
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
    return { module: "file", kind: "dir", id: idOrInput, path };
  }
  return { module: "file", kind: "dir", ...idOrInput };
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
    return { module: "file", kind: "symlink", id: idOrInput, path, target };
  }
  return { module: "file", kind: "symlink", ...idOrInput };
}
