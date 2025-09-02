import type { Matcher } from "@dot-steward/core";

export function darwin(): Matcher {
  return ({ os }) => os === "darwin";
}

export function linux(): Matcher {
  return ({ os }) => os === "linux";
}
