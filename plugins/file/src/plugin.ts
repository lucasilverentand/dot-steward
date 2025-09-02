import { Plugin } from "@dot-steward/core";
import type { FileItem } from "./items";

export class FilePlugin extends Plugin<FileItem> {
  name = "file";
}

export const plugin = new FilePlugin();
