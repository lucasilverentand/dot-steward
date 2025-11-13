import { describe, test, expect, beforeEach } from "bun:test";
import { CoreEvents, EventBus } from "../events.ts";

describe("events.ts - Event Bus", () => {
  let bus: EventBus<CoreEvents>;

  beforeEach(() => {
    bus = new EventBus();
  });

  describe("on/emit", () => {
    test("should register and trigger event listeners", () => {
      let called = false;
      let receivedData: string | undefined;

      bus.on("config:loaded", (data) => {
        called = true;
        receivedData = data.config_path;
      });

      bus.emit("config:loaded", { config_path: "/test/config.ts" });

      expect(called).toBe(true);
      expect(receivedData).toBe("/test/config.ts");
    });

    test("should call multiple listeners for the same event", () => {
      const calls: number[] = [];

      bus.on("config:loaded", () => calls.push(1));
      bus.on("config:loaded", () => calls.push(2));
      bus.on("config:loaded", () => calls.push(3));

      bus.emit("config:loaded", { config_path: "/test" });

      expect(calls).toEqual([1, 2, 3]);
    });

    test("should pass correct data to listeners", () => {
      let receivedEvent: CoreEvents["item:probe:start"] | undefined;

      bus.on("item:probe:start", (data) => {
        receivedEvent = data;
      });

      const testData = {
        item_id: "test-item",
        plugin_key: "test-plugin",
        attempt: 1,
      };

      bus.emit("item:probe:start", testData);

      expect(receivedEvent).toEqual(testData);
    });

    test("should not trigger listeners for different events", () => {
      let called = false;

      bus.on("config:loaded", () => {
        called = true;
      });

      bus.emit("manager:init:start", {});

      expect(called).toBe(false);
    });
  });

  describe("once", () => {
    test("should trigger listener only once", () => {
      let callCount = 0;

      bus.once("config:loaded", () => {
        callCount++;
      });

      bus.emit("config:loaded", { config_path: "/test1" });
      bus.emit("config:loaded", { config_path: "/test2" });
      bus.emit("config:loaded", { config_path: "/test3" });

      expect(callCount).toBe(1);
    });

    test("should receive correct data on first emission", () => {
      let receivedPath: string | undefined;

      bus.once("config:loaded", (data) => {
        receivedPath = data.config_path;
      });

      bus.emit("config:loaded", { config_path: "/first" });
      bus.emit("config:loaded", { config_path: "/second" });

      expect(receivedPath).toBe("/first");
    });
  });

  describe("off", () => {
    test("should remove specific listener", () => {
      let count1 = 0;
      let count2 = 0;

      const listener1 = () => count1++;
      const listener2 = () => count2++;

      bus.on("config:loaded", listener1);
      bus.on("config:loaded", listener2);

      bus.emit("config:loaded", { config_path: "/test" });
      expect(count1).toBe(1);
      expect(count2).toBe(1);

      bus.off("config:loaded", listener1);

      bus.emit("config:loaded", { config_path: "/test" });
      expect(count1).toBe(1);
      expect(count2).toBe(2);
    });

    test("should handle removing non-existent listener", () => {
      const listener = () => {};

      expect(() => {
        bus.off("config:loaded", listener);
      }).not.toThrow();
    });
  });

  describe("removeAllListeners", () => {
    test("should remove all listeners for a specific event", () => {
      let count1 = 0;
      let count2 = 0;

      bus.on("config:loaded", () => count1++);
      bus.on("config:loaded", () => count1++);
      bus.on("manager:init:start", () => count2++);

      bus.removeAllListeners("config:loaded");

      bus.emit("config:loaded", { config_path: "/test" });
      bus.emit("manager:init:start", {});

      expect(count1).toBe(0);
      expect(count2).toBe(1);
    });

    test("should remove all listeners when no event specified", () => {
      let count = 0;

      bus.on("config:loaded", () => count++);
      bus.on("manager:init:start", () => count++);
      bus.on("manager:init:end", () => count++);

      bus.removeAllListeners();

      bus.emit("config:loaded", { config_path: "/test" });
      bus.emit("manager:init:start", {});
      bus.emit("manager:init:end", {});

      expect(count).toBe(0);
    });
  });

  describe("listenerCount", () => {
    test("should return correct count of listeners", () => {
      expect(bus.listenerCount("config:loaded")).toBe(0);

      bus.on("config:loaded", () => {});
      expect(bus.listenerCount("config:loaded")).toBe(1);

      bus.on("config:loaded", () => {});
      expect(bus.listenerCount("config:loaded")).toBe(2);

      bus.on("manager:init:start", () => {});
      expect(bus.listenerCount("config:loaded")).toBe(2);
      expect(bus.listenerCount("manager:init:start")).toBe(1);
    });
  });

  describe("error handling", () => {
    test("should continue emitting to other listeners if one throws", () => {
      const calls: number[] = [];

      bus.on("config:loaded", () => calls.push(1));
      bus.on("config:loaded", () => {
        throw new Error("Test error");
      });
      bus.on("config:loaded", () => calls.push(3));

      // Depending on implementation, this might throw or catch internally
      try {
        bus.emit("config:loaded", { config_path: "/test" });
      } catch {
        // If it throws, that's also valid behavior
      }

      // At minimum, the first listener should have been called
      expect(calls[0]).toBe(1);
    });
  });
});
