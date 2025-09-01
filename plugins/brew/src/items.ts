import { Base, z } from "@dot-steward/core";

export const BrewTap = Base.extend({
  plugin: z.literal("brew"),
  kind: z.literal("tap"),
});
export const BrewFormula = Base.extend({
  plugin: z.literal("brew"),
  kind: z.literal("formula"),
});
export const BrewCask = Base.extend({
  plugin: z.literal("brew"),
  kind: z.literal("cask"),
});

export type Tap = z.infer<typeof BrewTap>;
export type Formula = z.infer<typeof BrewFormula>;
export type Cask = z.infer<typeof BrewCask>;

export const BrewItem = z.discriminatedUnion("kind", [
  BrewTap,
  BrewFormula,
  BrewCask,
]);
export type BrewItem = z.infer<typeof BrewItem>;
