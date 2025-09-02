import { describe, expect, test } from "bun:test";
import { pkg, plugin } from "..";

describe("apt pkg", () => {
  test("creates from string", () => {
    expect(pkg("vim")).toEqual({ plugin: "apt", kind: "pkg", id: "vim" });
  });

  test("creates from object", () => {
    expect(pkg({ id: "curl" })).toEqual({
      plugin: "apt",
      kind: "pkg",
      id: "curl",
    });
  });

  test("plugin exposes name", () => {
    expect(plugin.name).toBe("apt");
  });
});
