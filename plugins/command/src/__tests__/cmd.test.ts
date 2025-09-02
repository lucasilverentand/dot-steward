import { describe, expect, test } from "bun:test";
import { cmd, plugin } from "..";

describe("command cmd", () => {
  test("creates from string", () => {
    const item = cmd("update", "echo ok", "echo run");
    expect(item).toEqual({
      plugin: "command",
      kind: "cmd",
      id: "update",
      check: "echo ok",
      apply: "echo run",
    });
  });

  test("creates from object", () => {
    const input = { id: "install", check: "which foo", apply: "install foo" };
    expect(cmd(input)).toEqual({ plugin: "command", kind: "cmd", ...input });
  });

  test("throws when missing check or apply", () => {
    // @ts-expect-error missing apply
    expect(() => cmd("bad", "ok")).toThrow("check and apply are required");
  });

  test("plugin exposes name", () => {
    expect(plugin.name).toBe("command");
  });
});
