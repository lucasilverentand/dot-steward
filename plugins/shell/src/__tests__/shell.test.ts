import { describe, expect, test } from "bun:test";
import { env, alias, path, ShellConfig, plugin } from "..";

describe("shell plugin", () => {
  test("env from string", () => {
    expect(env("e", "KEY", "val")).toEqual({
      plugin: "shell",
      kind: "env",
      id: "e",
      key: "KEY",
      value: "val",
    });
  });

  test("alias from object", () => {
    const input = { id: "ls", name: "ll", command: "ls -la" };
    expect(alias(input)).toEqual({ plugin: "shell", kind: "alias", ...input });
  });

  test("path", () => {
    expect(path("p", "/usr/bin")).toEqual({
      plugin: "shell",
      kind: "path",
      id: "p",
      dir: "/usr/bin",
    });
  });

  test("throws when missing values", () => {
    // @ts-expect-error missing key/value
    expect(() => env("bad")).toThrow("key and value are required");
    // @ts-expect-error missing command
    expect(() => alias("bad", "ll")).toThrow("name and command are required");
    // @ts-expect-error missing dir
    expect(() => path("bad")).toThrow("dir is required");
  });

  test("ShellConfig renders collected items", () => {
    const config = new ShellConfig();
    config.collect(env("e1", "KEY", "value"));
    config.collect(path("p1", "/usr/bin"));
    config.collect(alias("a1", "ll", "ls -la"));
    const expected =
      'export KEY="value"\nexport PATH="/usr/bin:$PATH"\nalias ll=\'ls -la\'';
    expect(config.render("bash")).toBe(expected);
    expect(config.renderAll().bash).toBe(expected);
  });

  test("plugin schema parses items", () => {
    const item = env("id", "K", "V");
    expect(plugin.schema.parse(item)).toEqual(item);
  });
});
