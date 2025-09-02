import crypto from "node:crypto";

function randomString(length = 10): string {
  // base64url gives a dense, URL-safe string. Slice to requested length.
  return crypto
    .randomBytes(Math.ceil((length * 3) / 4))
    .toString("base64url")
    .slice(0, length);
}

export interface IdOptions {
  prefix?: string;
  length?: number;
}

export function generateId(prefixOrOptions?: string | IdOptions): string {
  const opts: IdOptions =
    typeof prefixOrOptions === "string"
      ? { prefix: prefixOrOptions }
      : (prefixOrOptions ?? {});
  const length = opts.length ?? 10;
  const core = randomString(length);
  return opts.prefix ? `${opts.prefix}-${core}` : core;
}
