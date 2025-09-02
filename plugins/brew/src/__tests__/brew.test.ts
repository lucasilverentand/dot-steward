import { describe, expect, test } from "bun:test";
import { tap, formula, cask, plugin } from "..";

describe("brew functions", () => {
  test("creates tap", () => {
    expect(tap("homebrew/cask")).toEqual({
      plugin: "brew",
      kind: "tap",
      id: "homebrew/cask",
    });
  });

  test("creates formula", () => {
    expect(formula({ id: "node" })).toEqual({
      plugin: "brew",
      kind: "formula",
      id: "node",
    });
  });

  test("creates cask", () => {
    expect(cask("google-chrome")).toEqual({
      plugin: "brew",
      kind: "cask",
      id: "google-chrome",
    });
  });

  test("plugin exposes name", () => {
    expect(plugin.name).toBe("brew");
  });
});
