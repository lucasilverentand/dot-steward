import { z } from "zod";
import { os, any } from "./host/matching.ts";
import { type Item, ItemSchema } from "./item.ts";
import { type Profile, ProfileSchema, profile } from "./profile.ts";

export const ConfigSchema = z.object({
  // Accept either an array of profiles or a flat array of items
  profiles: z.union([z.array(ProfileSchema), z.array(ItemSchema)]),
});

export class Config {
  readonly profiles: Profile[];

  constructor(input: Profile | Item | Profile[] | Item[]) {
    const arr = Array.isArray(input)
      ? (input as Array<Profile | Item>)
      : [input];
    // If given plain items, wrap them in a default always-on profile
    if (arr.length > 0 && (arr[0] as Item).kind !== "profile") {
      const items = arr as Item[];
      this.profiles = [
        profile({
          name: "default",
          matches: any(
            os("linux"),
            os("darwin"),
            os("win32"),
            os("unsupported"),
          ),
          items,
        }),
      ];
    } else {
      this.profiles = arr as Profile[];
    }
  }
}

export function config(p: Profile | Item | Profile[] | Item[]): Config {
  return new Config(p);
}
