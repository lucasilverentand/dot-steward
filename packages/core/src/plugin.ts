import { z } from "zod";
import { Item, ItemSchema, type ItemStatus, ItemStatusSchema } from "./item.ts";
import { type HostMatchExpr, HostMatchExprSchema } from "./host/matching.ts";

export const PluginSchema = ItemSchema.extend({
  name: z.string().min(2).max(100),
  status: ItemStatusSchema.optional(),
  matches: HostMatchExprSchema, // required: every plugin must declare compatibility
});

export abstract class Plugin extends Item {
  readonly name: string;
  readonly matches: HostMatchExpr;

  constructor(name: string, matches: HostMatchExpr, opts?: { status?: ItemStatus }) {
    super({ kind: "plugin", state: opts?.status ? { status: opts.status } : undefined });
    this.name = name;
    this.matches = matches;
  }
}
