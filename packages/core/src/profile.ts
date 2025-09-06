import { z } from "zod";
import { type HostMatchExpr, HostMatchExprSchema } from "./host/matching.ts";
import { Item, ItemSchema, type ItemStatus } from "./item.ts";

// Inputs are defined via a Zod schema (typically a ZodObject) describing
// the shape and defaults for profile parameters.
export type ProfileInputsSchema = z.ZodTypeAny; // commonly a z.ZodObject

// Helper to conditionally include items during composition
export function when(
  cond: boolean,
  ...items: Array<Item | Item[] | null | undefined | false>
): Item[] {
  if (!cond) return [];
  const out: Item[] = [];
  for (const it of items) {
    if (!it) continue;
    if (Array.isArray(it)) {
      for (const x of it) if (x) out.push(x);
    } else {
      out.push(it);
    }
  }
  return out;
}

export const ProfileSchema = ItemSchema.extend({
  name: z.string().min(2).max(100),
  matches: HostMatchExprSchema,
});

export class Profile extends Item {
  readonly name: string;
  readonly matches: HostMatchExpr;
  readonly items: Item[];
  readonly inputs?: ProfileInputsSchema;
  readonly values: Record<string, unknown>;

  constructor(
    name: string,
    matches: HostMatchExpr,
    items: Item[] = [],
    options?: {
      status?: ItemStatus;
      inputs?: ProfileInputsSchema;
      values?: Record<string, unknown>;
    },
  ) {
    // Validate constructor inputs
    z.object({ name: z.string().min(2).max(100), matches: HostMatchExprSchema })
      .strict()
      .parse({ name, matches });
    super({
      kind: "profile",
      state: options?.status ? { status: options.status } : undefined,
    });
    this.name = name;
    this.matches = matches;
    this.inputs = options?.inputs;
    this.values = resolveInputValues(options?.inputs, options?.values);
    this.items = items;
  }

  async probe(
    _ctx: import("./host/context.ts").HostContext,
  ): Promise<ItemStatus> {
    return this.state.status;
  }

  async validate(_ctx: import("./host/context.ts").HostContext): Promise<void> {
    // Profiles are containers; no validation needed by default.
  }

  async apply(_ctx: import("./host/context.ts").HostContext): Promise<void> {
    // Profiles group items; application orchestration can be handled elsewhere.
  }
}

// Normalize possibly nested item arrays
function normalizeItems(items: Array<Item | Item[] | null | undefined | false>): Item[] {
  const out: Item[] = [];
  for (const it of items) {
    if (!it) continue;
    if (Array.isArray(it)) out.push(...it.filter(Boolean) as Item[]);
    else out.push(it);
  }
  return out;
}

function resolveInputValues(
  schema: ProfileInputsSchema | undefined,
  provided: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!schema) return {};
  const base = provided ?? {};
  // Let Zod handle defaults and type coercion as defined by the schema.
  const parsed = schema.parse(base);
  // Ensure we always return a plain object
  return (parsed && typeof parsed === "object") ? (parsed as Record<string, unknown>) : {};
}

export function profile<S extends ProfileInputsSchema = z.ZodTypeAny>({
  name,
  matches,
  items,
  inputs,
  values,
}: {
  name: string;
  matches: HostMatchExpr;
  // Items can be a static list or a builder using inputs
  items?:
    | Item[]
    | ((ctx: { input: z.infer<S>; when: typeof when }) => Array<Item | Item[] | null | undefined | false>);
  inputs?: S;
  values?: Record<string, unknown>;
}): Profile {
  // Validate basic factory inputs (user-facing)
  z.object({
    name: z.string().min(2).max(100),
    matches: HostMatchExprSchema,
  })
    .strict()
    .parse({ name, matches });
  const resolvedValues = resolveInputValues(inputs, values);
  let built: Item[] = [];
  if (typeof items === "function") {
    const res = items({ input: resolvedValues as z.infer<S>, when });
    built = normalizeItems(res);
  } else if (Array.isArray(items)) {
    built = normalizeItems(items);
  }
  return new Profile(name, matches, built, { inputs, values: resolvedValues });
}
