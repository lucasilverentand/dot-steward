import * as path from "node:path";
import { pathToFileURL } from "node:url";

// Resolve a config path (relative or absolute) to a file URL string
export function resolveConfigToFileUrl(p: string): string {
  const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  return pathToFileURL(abs).href;
}

export default resolveConfigToFileUrl;
