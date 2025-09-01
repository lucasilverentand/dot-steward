import { Plugin } from "@dot-steward/core";
import { FileItem } from "./items";

export class FilePlugin extends Plugin<FileItem> {
  name = "file";
  schema = FileItem;
}

export const plugin = new FilePlugin();
