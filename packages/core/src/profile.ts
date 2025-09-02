import type { Matcher } from "./matcher";

// Minimal item shape: plugins contribute concrete schemas, but the DSL only
// requires the common keys to track and group items.
export interface ItemBase {
  id: string;
  plugin: string;
  kind: string;
  // allow additional fields from plugins
  [key: string]: unknown;
}

export interface ProfileValue {
  name: string;
  match: Matcher;
  items: ItemBase[];
}

export class ProfileBuilder {
  readonly value: ProfileValue;

  constructor(name: string, match: Matcher) {
    this.value = { name, match, items: [] };
  }

  // Accept a single item, an array of items, or nested arrays
  add(
    ...entries: Array<
      ItemBase | ItemBase[] | ReadonlyArray<ItemBase | ItemBase[]>
    >
  ): this {
    const flat: ItemBase[] = [];
    const push = (
      e: ItemBase | ItemBase[] | ReadonlyArray<ItemBase | ItemBase[]>,
    ) => {
      if (Array.isArray(e)) {
        for (const x of e) push(x as ItemBase | ItemBase[]);
      } else if (e) {
        flat.push(e as ItemBase);
      }
    };
    for (const entry of entries) push(entry);
    this.value.items.push(...flat);
    return this;
  }
}

export function profile(name: string, match: Matcher): ProfileBuilder {
  return new ProfileBuilder(name, match);
}

export type Profile = ProfileValue;
