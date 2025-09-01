import { describe, expect, test } from "bun:test";
import { Item, profile, plan, apt } from "..";

describe("dot-steward", () => {
  test("profile defaults items to empty array", () => {
    const p = profile("id", { match: { os: "linux" } });
    expect(p).toEqual({ id: "id", match: { os: "linux" }, items: [] });
  });

  test("plan returns given plan", () => {
    const p = { profiles: [] };
    expect(plan(p)).toBe(p);
  });

  test("Item schema parses plugin item", () => {
    const item = apt.pkg("vim");
    expect(Item.parse(item)).toEqual(item);
  });
});
