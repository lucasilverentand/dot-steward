// Minimal stable JSON stringifier for hashing purposes
export function stableStringify(input: unknown): string {
  return JSON.stringify(sortRec(input));
}

function sortRec(val: unknown): unknown {
  if (val === null || typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(sortRec);
  const obj = val as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortRec(obj[key]);
  }
  return out;
}

export function hashString(s: string): string {
  type BunLike = {
    hash?: (x: string | ArrayBufferView | ArrayBuffer) => bigint;
  };
  const bun = (globalThis as unknown as { Bun?: BunLike }).Bun;
  if (bun?.hash) {
    const val: bigint = bun.hash(s);
    // Normalize to lower-case hex without 0x prefix
    return val.toString(16);
  }
  // Fallback: Lightweight djb2 32-bit hex
  let hash = 5381;
  for (let i = 0; i < s.length; i++) hash = (hash * 33) ^ s.charCodeAt(i);
  const u = hash >>> 0;
  return u.toString(16).padStart(8, "0");
}
