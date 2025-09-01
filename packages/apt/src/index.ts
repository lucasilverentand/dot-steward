import { Base, z } from "@dot-steward/core";

export const AptItem = Base.extend({
  module: z.literal("apt"),
  kind: z.literal("pkg"),
});

export type Apt = z.infer<typeof AptItem>;

type PkgInput = Omit<Apt, "module" | "kind">;

export function pkg(id: string): Apt;
export function pkg(input: PkgInput): Apt;
export function pkg(idOrInput: string | PkgInput): Apt {
  if (typeof idOrInput === "string") {
    return { module: "apt", kind: "pkg", id: idOrInput };
  }
  return { module: "apt", kind: "pkg", ...idOrInput };
}
