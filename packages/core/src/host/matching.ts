import * as osmod from "node:os";
import { z } from "zod";
import {
  HostArchSchema,
  type HostEnv,
  HostOSSchema,
  type HostUser,
} from "./context.ts";

export type HostContextLike = {
  os: z.infer<typeof HostOSSchema> | null;
  arch: z.infer<typeof HostArchSchema> | null;
  env: HostEnv;
  user: HostUser;
};

export type HostMatchExpr =
  | { type: "all"; of: HostMatchExpr[] }
  | { type: "any"; of: HostMatchExpr[] }
  | { type: "os"; values: Array<z.infer<typeof HostOSSchema>> }
  | { type: "arch"; values: Array<z.infer<typeof HostArchSchema>> }
  | { type: "hostname"; value: StringCond }
  | {
      type: "eq";
      key:
        | "env.ci"
        | "env.devcontainer"
        | "user.name"
        | "user.uid"
        | "user.gid"
        | "user.home"
        | "user.can_sudo"
        | "user.is_root";
      value: string | boolean | { matches: string; flags?: string };
    }
  | { type: "env-var"; name: string; value?: StringCond }; // value omitted => existence check

type StringCond = string | { matches: string; flags?: string };

export const HostMatchExprSchema: z.ZodType<HostMatchExpr> = z.lazy(() =>
  z.union([
    z
      .object({
        type: z.literal("all"),
        of: z.array(HostMatchExprSchema).min(1),
      })
      .strict(),
    z
      .object({
        type: z.literal("any"),
        of: z.array(HostMatchExprSchema).min(1),
      })
      .strict(),
    z
      .object({ type: z.literal("os"), values: z.array(HostOSSchema).min(1) })
      .strict(),
    z
      .object({
        type: z.literal("arch"),
        values: z.array(HostArchSchema).min(1),
      })
      .strict(),
    z
      .object({
        type: z.literal("hostname"),
        value: z.union([
          z.string().min(1),
          z
            .object({
              matches: z.string().min(1),
              flags: z.string().optional(),
            })
            .strict(),
        ]),
      })
      .strict(),
    z
      .object({
        type: z.literal("eq"),
        key: z.enum([
          "env.ci",
          "env.devcontainer",
          "user.name",
          "user.uid",
          "user.gid",
          "user.home",
          "user.can_sudo",
          "user.is_root",
        ]),
        value: z.union([
          z.string(),
          z.boolean(),
          z
            .object({
              matches: z.string().min(1),
              flags: z.string().optional(),
            })
            .strict(),
        ]),
      })
      .strict(),
    z
      .object({
        type: z.literal("env-var"),
        name: z.string().min(1),
        value: z
          .union([
            z.string(),
            z
              .object({
                matches: z.string().min(1),
                flags: z.string().optional(),
              })
              .strict(),
          ])
          .optional(),
      })
      .strict(),
  ]),
);

export function all(...exprs: HostMatchExpr[]): HostMatchExpr {
  return { type: "all", of: exprs };
}

export function any(...exprs: HostMatchExpr[]): HostMatchExpr {
  return { type: "any", of: exprs };
}

export function os(
  ...values: Array<z.infer<typeof HostOSSchema>>
): HostMatchExpr {
  return { type: "os", values };
}

export function arch(
  ...values: Array<z.infer<typeof HostArchSchema>>
): HostMatchExpr {
  return { type: "arch", values };
}

export function hostname(value: StringCond): HostMatchExpr {
  return { type: "hostname", value };
}

// user/env equality helpers
export const ci = (v: boolean): HostMatchExpr => ({
  type: "eq",
  key: "env.ci",
  value: v,
});
export const devcontainer = (v: boolean): HostMatchExpr => ({
  type: "eq",
  key: "env.devcontainer",
  value: v,
});
export const user = (v: StringCond): HostMatchExpr => ({
  type: "eq",
  key: "user.name",
  value: v,
});
export const uid = (v: StringCond): HostMatchExpr => ({
  type: "eq",
  key: "user.uid",
  value: v,
});
export const gid = (v: StringCond): HostMatchExpr => ({
  type: "eq",
  key: "user.gid",
  value: v,
});
export const home = (v: StringCond): HostMatchExpr => ({
  type: "eq",
  key: "user.home",
  value: v,
});
export const can_sudo = (v: boolean): HostMatchExpr => ({
  type: "eq",
  key: "user.can_sudo",
  value: v,
});
export const is_root = (v: boolean): HostMatchExpr => ({
  type: "eq",
  key: "user.is_root",
  value: v,
});
export const env_var = (name: string, value?: StringCond): HostMatchExpr => ({
  type: "env-var",
  name,
  value,
});

function toRegExp(pattern: string, flags?: string): RegExp | null {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

export function evalMatchExpr(
  ctx: HostContextLike,
  expr: HostMatchExpr,
): boolean {
  switch (expr.type) {
    case "all":
      return expr.of.every((e) => evalMatchExpr(ctx, e));
    case "any":
      return expr.of.some((e) => evalMatchExpr(ctx, e));
    case "os":
      return ctx.os !== null && expr.values.includes(ctx.os);
    case "arch":
      return ctx.arch !== null && expr.values.includes(ctx.arch);
    case "hostname": {
      const actual = osmod.hostname();
      const v = expr.value;
      if (typeof v === "string") return actual === v;
      const re = toRegExp(v.matches, v.flags);
      return !!re && re.test(actual);
    }
    case "eq": {
      const k = expr.key;
      const v = expr.value as unknown;
      if (k === "env.ci") return ctx.env.ci === v;
      if (k === "env.devcontainer") return ctx.env.devcontainer === v;
      if (k === "user.can_sudo") return ctx.user.can_sudo === v;
      if (k === "user.is_root") return ctx.user.is_root === v;
      // string fields with optional regex
      const matchStr = (actual: string | null) => {
        if (actual === null) return false;
        if (typeof v === "string") return actual === v;
        if (typeof v === "object" && v && "matches" in v) {
          const re = toRegExp(
            (v as { matches: string; flags?: string }).matches,
            (v as { matches: string; flags?: string }).flags,
          );
          return !!re && re.test(actual);
        }
        return false;
      };
      if (k === "user.name") return matchStr(ctx.user.name);
      if (k === "user.uid") return matchStr(ctx.user.uid);
      if (k === "user.gid") return matchStr(ctx.user.gid);
      if (k === "user.home") return matchStr(ctx.user.home);
      return false;
    }
    case "env-var": {
      const val = ctx.env.variables[expr.name];
      if (expr.value === undefined) return val !== undefined; // existence
      if (typeof expr.value === "string") return val === expr.value;
      if (typeof val !== "string") return false;
      const re = toRegExp(expr.value.matches, expr.value.flags);
      return !!re && re.test(val);
    }
  }
}
