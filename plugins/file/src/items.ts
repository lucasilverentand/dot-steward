import { Base, z } from "@dot-steward/core";

export const FileEnsure = Base.extend({
  plugin: z.literal("file"),
  kind: z.literal("ensure"),
  path: z.string(),
  content: z.string().default(""),
});
export const FileDir = Base.extend({
  plugin: z.literal("file"),
  kind: z.literal("dir"),
  path: z.string(),
});
export const FileSymlink = Base.extend({
  plugin: z.literal("file"),
  kind: z.literal("symlink"),
  path: z.string(),
  target: z.string(),
});

export type Ensure = z.infer<typeof FileEnsure>;
export type Dir = z.infer<typeof FileDir>;
export type Symlink = z.infer<typeof FileSymlink>;

export const FileItem = z.discriminatedUnion("kind", [
  FileEnsure,
  FileDir,
  FileSymlink,
]);
export type FileItem = z.infer<typeof FileItem>;
