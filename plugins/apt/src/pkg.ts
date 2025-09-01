import type { Apt } from "./item";

type PkgInput = Omit<Apt, "plugin" | "kind">;

export function pkg(id: string): Apt;
export function pkg(input: PkgInput): Apt;
export function pkg(idOrInput: string | PkgInput): Apt {
  if (typeof idOrInput === "string") {
    return { plugin: "apt", kind: "pkg", id: idOrInput };
  }
  return { plugin: "apt", kind: "pkg", ...idOrInput };
}
