import type { Profile, ProfileBuilder } from "./profile";

export interface Plan {
  profiles: Profile[];
}

export interface PlanInput {
  profiles: ProfileBuilder[];
}

export function config(input: PlanInput): Plan {
  return {
    profiles: input.profiles.map((p) => p.value),
  };
}
