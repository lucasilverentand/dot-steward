import z from "zod";
import { type Profile, ProfileSchema } from "./profile.ts";

export const ConfigSchema = z.object({
  profiles: z.array(ProfileSchema),
});

export class Config {
  readonly profiles: Profile[];

  constructor(profiles: Profile[]) {
    this.profiles = profiles;
  }
}

export function config({
  profiles,
}: {
  profiles: Profile[];
}): Config {
  return new Config(profiles);
}
