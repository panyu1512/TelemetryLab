import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bus = vi.hoisted(() => ({
  broadcasts: [] as { topic: string; payload: unknown }[],
  handlers: {} as Record<string, (payload: unknown) => void>,
}));

vi.mock("../lib/windowBus", () => ({
  broadcast: (topic: string, payload: unknown) => {
    bus.broadcasts.push({ topic, payload });
  },
  subscribe: (topic: string, handler: (payload: unknown) => void) => {
    bus.handlers[topic] = handler;
    return () => {};
  },
}));

import { sanitizeOverrides, useClassColorsStore } from "./useClassColorsStore";

const store = () => useClassColorsStore.getState();

beforeEach(() => {
  const backing = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => void backing.set(k, v),
    removeItem: (k: string) => void backing.delete(k),
    clear: () => backing.clear(),
  };
  bus.broadcasts.length = 0;
  useClassColorsStore.setState({ overrides: {} });
});

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("sanitizeOverrides", () => {
  it("keeps name → #rrggbb pairs, lower-cased", () => {
    expect(sanitizeOverrides({ GT3: "#FF8800" })).toEqual({ GT3: "#ff8800" });
  });

  it("drops anything else a stored or remote value could hold", () => {
    expect(sanitizeOverrides({ GT3: "red", GT4: 12, "": "#ffffff", LMP2: "#12345" })).toEqual({});
    expect(sanitizeOverrides(null)).toEqual({});
    expect(sanitizeOverrides("GT3")).toEqual({});
  });
});

describe("class colour picks", () => {
  it("sets, persists and broadcasts a pick", () => {
    store().setClassColor("GT3", "#FF8800");
    expect(store().overrides).toEqual({ GT3: "#ff8800" });
    expect(JSON.parse(localStorage.getItem("telemetrylab.class-colors.v1")!).overrides).toEqual({
      GT3: "#ff8800",
    });
    expect(bus.broadcasts[bus.broadcasts.length - 1]?.topic).toBe("class-colors:changed");
  });

  it("puts a class back on the ramp when its pick is cleared", () => {
    store().setClassColor("GT3", "#ff8800");
    store().setClassColor("GT3", null);
    expect(store().overrides).toEqual({});
  });

  it("ignores an invalid colour instead of storing it", () => {
    store().setClassColor("GT3", "orange");
    expect(store().overrides).toEqual({});
  });

  it("clears every pick at once", () => {
    store().setClassColor("GT3", "#ff8800");
    store().setClassColor("GT4", "#00ff00");
    store().resetAll();
    expect(store().overrides).toEqual({});
  });

  it("adopts picks from another window without echoing them back", () => {
    bus.broadcasts.length = 0;
    bus.handlers["class-colors:changed"]?.({ overrides: { LMP2: "#ABCDEF", bad: 3 } });
    expect(store().overrides).toEqual({ LMP2: "#abcdef" });
    expect(bus.broadcasts).toHaveLength(0);
  });
});
