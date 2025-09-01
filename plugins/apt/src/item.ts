import { Base, z } from "@dot-steward/core";

export const AptItem = Base.extend({
  plugin: z.literal("apt"),
  kind: z.literal("pkg"),
});

export type Apt = z.infer<typeof AptItem>;
