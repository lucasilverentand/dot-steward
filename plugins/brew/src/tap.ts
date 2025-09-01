import type { Tap } from "./items";

type TapInput = Omit<Tap, "plugin" | "kind">;

export function tap(id: string): Tap;
export function tap(input: TapInput): Tap;
export function tap(idOrInput: string | TapInput): Tap {
  if (typeof idOrInput === "string") {
    return { plugin: "brew", kind: "tap", id: idOrInput };
  }
  return { plugin: "brew", kind: "tap", ...idOrInput };
}
