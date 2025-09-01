import { describe, expect, test } from "bun:test";
import { Base, OS, Plugin, z } from "..";

class DummyPlugin extends Plugin<{ id: string }> {
  name = "dummy";
  schema = z.object({ id: z.string() });
}

describe("core", () => {
  test("Base schema validates id", () => {
    expect(Base.parse({ id: "abc" })).toEqual({ id: "abc" });
    expect(() => Base.parse({ id: "" })).toThrow();
  });

  test("OS enum has expected options", () => {
    expect(OS.options).toEqual(["darwin", "linux", "win32"]);
    // @ts-expect-error invalid OS
    expect(() => OS.parse("freebsd")).toThrow();
  });

  test("Plugin subclass holds name and schema", () => {
    const plugin = new DummyPlugin();
    expect(plugin.name).toBe("dummy");
    expect(plugin.schema.parse({ id: "x" })).toEqual({ id: "x" });
  });
});
