import { describe, expect, test } from "bun:test";
import { ensure, dir, symlink, plugin } from "..";

describe("file plugin", () => {
  test("ensure from string", () => {
    expect(ensure("cfg", "/tmp/config", "content")).toEqual({
      plugin: "file",
      kind: "ensure",
      id: "cfg",
      path: "/tmp/config",
      content: "content",
    });
  });

  test("ensure from object defaults content", () => {
    expect(ensure({ id: "cfg", path: "/tmp/config" })).toEqual({
      plugin: "file",
      kind: "ensure",
      id: "cfg",
      path: "/tmp/config",
      content: "",
    });
  });

  test("dir", () => {
    expect(dir("data", "/var/data")).toEqual({
      plugin: "file",
      kind: "dir",
      id: "data",
      path: "/var/data",
    });
  });

  test("symlink", () => {
    expect(
      symlink({ id: "link", path: "/tmp/link", target: "/tmp/target" }),
    ).toEqual({
      plugin: "file",
      kind: "symlink",
      id: "link",
      path: "/tmp/link",
      target: "/tmp/target",
    });
  });

  test("ensure throws without path", () => {
    // @ts-expect-error missing path
    expect(() => ensure("bad")).toThrow("path is required");
  });

  test("symlink throws without target", () => {
    // @ts-expect-error missing target
    expect(() => symlink("bad", "/tmp/link")).toThrow(
      "path and target are required",
    );
  });

  test("plugin exposes name", () => {
    expect(plugin.name).toBe("file");
  });
});
