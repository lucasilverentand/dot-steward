import { Base, Plugin, z } from "@dot-steward/core";

export const AptItem = Base.extend({
  plugin: z.literal("apt"),
  kind: z.literal("pkg"),
});

export type Apt = z.infer<typeof AptItem>;

type PkgInput = Omit<Apt, "plugin" | "kind">;

export function pkg(id: string): Apt;
export function pkg(input: PkgInput): Apt;
export function pkg(idOrInput: string | PkgInput): Apt {
  if (typeof idOrInput === "string") {
    return { plugin: "apt", kind: "pkg", id: idOrInput };
  }
  return { plugin: "apt", kind: "pkg", ...idOrInput };
}

export class AptPlugin extends Plugin<Apt> {
  name = "apt";
  schema = AptItem;
}

export const plugin = new AptPlugin();
