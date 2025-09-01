import type { OS } from "@dot-steward/core";
import type { Item } from "./item";

export interface Match {
  os?: OS;
  hostname?: string | string[];
  user?: string;
}

export interface Profile {
  id: string;
  match?: Match;
  include?: string[];
  items: Item[];
}

export function profile(id: string, data: Omit<Profile, "id">): Profile {
  return { id, ...data, items: data.items ?? [] };
}
