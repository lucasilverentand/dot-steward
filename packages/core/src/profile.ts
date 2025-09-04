import { z } from "zod";
import { type HostMatchExpr, HostMatchExprSchema } from "./host/matching.ts";
import { Item, ItemSchema, type ItemStatus } from "./item.ts";

export const ProfileSchema = ItemSchema.extend({
  name: z.string().min(2).max(100),
  matches: HostMatchExprSchema,
});

export class Profile extends Item {
  readonly name: string;
  readonly matches: HostMatchExpr;
  readonly items: Item[];

  constructor(
    name: string,
    matches: HostMatchExpr,
    items: Item[] = [],
    opts?: { status?: ItemStatus },
  ) {
    // Validate constructor inputs
    z.object({ name: z.string().min(2).max(100), matches: HostMatchExprSchema })
      .strict()
      .parse({ name, matches });
    super({
      kind: "profile",
      state: opts?.status ? { status: opts.status } : undefined,
    });
    this.name = name;
    this.matches = matches;
    this.items = items;
  }

  async probe(
    _ctx: import("./host/context.ts").HostContext,
  ): Promise<ItemStatus> {
    return this.state.status;
  }

  async apply(_ctx: import("./host/context.ts").HostContext): Promise<void> {
    // Profiles group items; application orchestration can be handled elsewhere.
  }
}

export function profile({
  name,
  matches,
  items,
}: { name: string; matches: HostMatchExpr; items?: Item[] }): Profile {
  // Validate factory inputs (user-facing)
  z.object({
    name: z.string().min(2).max(100),
    matches: HostMatchExprSchema,
    items: z.array(z.any()).optional(),
  })
    .strict()
    .parse({ name, matches, items });
  return new Profile(name, matches, items ?? []);
}
