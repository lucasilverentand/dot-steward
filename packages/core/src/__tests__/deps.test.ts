import { describe, test, expect } from "bun:test";
import { topological_sort, get_roots, get_leaves, has_cycle } from "../deps.ts";
import { createMockItem } from "./test-utils.ts";

describe("deps.ts - Dependency Graph", () => {
  describe("topological_sort", () => {
    test("should sort items with no dependencies", () => {
      const items = [
        createMockItem("a"),
        createMockItem("b"),
        createMockItem("c"),
      ];

      const sorted = topological_sort(items);
      expect(sorted).toHaveLength(3);
      expect(sorted.map((i) => i.id)).toContain("a");
      expect(sorted.map((i) => i.id)).toContain("b");
      expect(sorted.map((i) => i.id)).toContain("c");
    });

    test("should sort items with simple dependencies", () => {
      const items = [
        createMockItem("c", { depends_on: ["b"] }),
        createMockItem("b", { depends_on: ["a"] }),
        createMockItem("a"),
      ];

      const sorted = topological_sort(items);
      expect(sorted.map((i) => i.id)).toEqual(["a", "b", "c"]);
    });

    test("should handle diamond dependencies", () => {
      const items = [
        createMockItem("d", { depends_on: ["b", "c"] }),
        createMockItem("c", { depends_on: ["a"] }),
        createMockItem("b", { depends_on: ["a"] }),
        createMockItem("a"),
      ];

      const sorted = topological_sort(items);
      const ids = sorted.map((i) => i.id);

      expect(ids[0]).toBe("a");
      expect(ids[3]).toBe("d");
      expect(ids.indexOf("b")).toBeLessThan(ids.indexOf("d"));
      expect(ids.indexOf("c")).toBeLessThan(ids.indexOf("d"));
    });

    test("should handle items with multiple dependencies", () => {
      const items = [
        createMockItem("d", { depends_on: ["a", "b", "c"] }),
        createMockItem("c"),
        createMockItem("b"),
        createMockItem("a"),
      ];

      const sorted = topological_sort(items);
      const ids = sorted.map((i) => i.id);

      expect(ids[3]).toBe("d");
    });
  });

  describe("get_roots", () => {
    test("should identify root nodes with no dependencies", () => {
      const items = [
        createMockItem("c", { depends_on: ["a", "b"] }),
        createMockItem("b"),
        createMockItem("a"),
      ];

      const roots = get_roots(items);
      expect(roots.map((i) => i.id).sort()).toEqual(["a", "b"]);
    });

    test("should return all items when none have dependencies", () => {
      const items = [
        createMockItem("a"),
        createMockItem("b"),
        createMockItem("c"),
      ];

      const roots = get_roots(items);
      expect(roots).toHaveLength(3);
    });

    test("should return empty array when all items have dependencies", () => {
      const items = [
        createMockItem("b", { depends_on: ["a"] }),
        createMockItem("c", { depends_on: ["b"] }),
      ];

      const roots = get_roots(items);
      expect(roots).toHaveLength(0);
    });
  });

  describe("get_leaves", () => {
    test("should identify leaf nodes that nothing depends on", () => {
      const items = [
        createMockItem("a"),
        createMockItem("b", { depends_on: ["a"] }),
        createMockItem("c", { depends_on: ["a"] }),
      ];

      const leaves = get_leaves(items);
      expect(leaves.map((i) => i.id).sort()).toEqual(["b", "c"]);
    });

    test("should return all items when none are depended upon", () => {
      const items = [
        createMockItem("a"),
        createMockItem("b"),
        createMockItem("c"),
      ];

      const leaves = get_leaves(items);
      expect(leaves).toHaveLength(3);
    });
  });

  describe("has_cycle", () => {
    test("should detect simple cycle", () => {
      const items = [
        createMockItem("a", { depends_on: ["b"] }),
        createMockItem("b", { depends_on: ["a"] }),
      ];

      const cycle = has_cycle(items);
      expect(cycle).toBe(true);
    });

    test("should detect indirect cycle", () => {
      const items = [
        createMockItem("a", { depends_on: ["b"] }),
        createMockItem("b", { depends_on: ["c"] }),
        createMockItem("c", { depends_on: ["a"] }),
      ];

      const cycle = has_cycle(items);
      expect(cycle).toBe(true);
    });

    test("should return false for acyclic graph", () => {
      const items = [
        createMockItem("a"),
        createMockItem("b", { depends_on: ["a"] }),
        createMockItem("c", { depends_on: ["b"] }),
      ];

      const cycle = has_cycle(items);
      expect(cycle).toBe(false);
    });

    test("should return false for diamond dependency", () => {
      const items = [
        createMockItem("a"),
        createMockItem("b", { depends_on: ["a"] }),
        createMockItem("c", { depends_on: ["a"] }),
        createMockItem("d", { depends_on: ["b", "c"] }),
      ];

      const cycle = has_cycle(items);
      expect(cycle).toBe(false);
    });

    test("should return false for empty graph", () => {
      const cycle = has_cycle([]);
      expect(cycle).toBe(false);
    });
  });
});
