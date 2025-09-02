import { describe, expect, test } from "bun:test";
import { OS, Plugin } from "..";

class DummyPlugin extends Plugin<{ id: string }> {
  name = "dummy";
}

describe("core", () => {
  test("OS enum has expected options", () => {
    expect(OS.options).toEqual(["darwin", "linux", "win32"]);
    // @ts-expect-error invalid OS
    expect(() => OS.parse("freebsd")).toThrow();
  });

  test("Plugin subclass holds name", () => {
    const plugin = new DummyPlugin();
    expect(plugin.name).toBe("dummy");
  });
});
