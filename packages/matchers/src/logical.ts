import type { Matcher } from "@dot-steward/core";

// Accept either a list of matchers or a single array of matchers
export function any(...m: Matcher[]): Matcher;
export function any(m: Matcher[]): Matcher;
export function any(...args: [Matcher[]] | Matcher[]): Matcher {
  const matchers: Matcher[] = Array.isArray(args[0])
    ? (args[0] as Matcher[])
    : (args as Matcher[]);
  return (ctx) => matchers.some((fn) => fn(ctx));
}

export const match_any = any;
