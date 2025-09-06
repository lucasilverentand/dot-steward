import { z } from "zod";
import { type HostMatchExpr, HostMatchExprSchema } from "./host/matching.ts";
import { Item, ItemSchema, type ItemStatus } from "./item.ts";

// Lightweight inputs system to parameterize profiles and compose items conditionally
export const ProfileInputSpecSchema = z.object({
  type: z.enum(["string", "boolean", "number", "select"]).default("string"),
  // default value parsed according to type
  default: z.any().optional(),
  // for type === select
  choices: z.array(z.string()).optional(),
  // description for future prompting/UI
  description: z.string().optional(),
});

export type ProfileInputSpec = z.infer<typeof ProfileInputSpecSchema>;

export type ProfileInputsSpec = Record<string, ProfileInputSpec>;

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
  readonly inputs?: ProfileInputsSpec;
  readonly values: Record<string, unknown>;

  constructor(
    name: string,
    matches: HostMatchExpr,
    items: Item[] = [],
    options?: {
      status?: ItemStatus;
      inputs?: ProfileInputsSpec;
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

function coerceValue(spec: ProfileInputSpec, raw: unknown): unknown {
  if (raw === undefined || raw === null || raw === "") return undefined;
  switch (spec.type) {
    case "boolean": {
      if (typeof raw === "boolean") return raw;
      const s = String(raw).toLowerCase();
      return s === "1" || s === "true" || s === "yes" || s === "y";
    }
    case "number": {
      if (typeof raw === "number") return raw;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    }
    case "select":
    case "string":
    default: {
      const v = String(raw);
      if (spec.type === "select" && spec.choices && spec.choices.length > 0) {
        return spec.choices.includes(v) ? v : spec.default;
      }
      return v;
    }
  }
}

function resolveInputValues(
  spec: ProfileInputsSpec | undefined,
  provided: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  if (!spec || Object.keys(spec).length === 0) return values;
  for (const [k, s] of Object.entries(spec)) {
    // precedence: provided -> default
    const fromProvided = provided && Object.prototype.hasOwnProperty.call(provided, k) ? provided[k] : undefined;
    const val = coerceValue(s, fromProvided ?? s.default);
    if (val !== undefined) values[k] = val;
  }
  return values;
}

export function profile({
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
    | ((ctx: { input: Record<string, unknown>; when: typeof when }) => Array<Item | Item[] | null | undefined | false>);
  inputs?: ProfileInputsSpec;
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
    const res = items({ input: resolvedValues, when });
    built = normalizeItems(res);
  } else if (Array.isArray(items)) {
    built = normalizeItems(items);
  }
  return new Profile(name, matches, built, { inputs, values: resolvedValues });
}
