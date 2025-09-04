import { z } from "zod";
import { type HostMatchExpr, HostMatchExprSchema } from "./host/matching.ts";
import { Item, ItemSchema, type ItemStatus } from "./item.ts";

export const PluginSchema = ItemSchema.extend({
  name: z.string().min(2).max(100),
  matches: HostMatchExprSchema, // required: every plugin must declare compatibility
});

export abstract class Plugin extends Item {
  readonly name: string;
  readonly matches: HostMatchExpr;

  constructor(
    name: string,
    matches: HostMatchExpr,
    opts?: { status?: ItemStatus },
  ) {
    // Validate constructor inputs
    z.object({ name: z.string().min(2).max(100), matches: HostMatchExprSchema })
      .strict()
      .parse({ name, matches });
    super({
      kind: "plugin",
      state: opts?.status ? { status: opts.status } : undefined,
    });
    this.name = name;
    this.matches = matches;
  }
}
