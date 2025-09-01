import { Base, z } from "@dot-steward/core";

export const CommandItem = Base.extend({
  plugin: z.literal("command"),
  kind: z.literal("cmd"),
  check: z.string().min(1),
  apply: z.string().min(1),
});

export type Command = z.infer<typeof CommandItem>;
