import type { Profile } from "./profile";

export interface Plan {
  profiles: Profile[];
}

export function plan(p: Plan): Plan {
  return p;
}
