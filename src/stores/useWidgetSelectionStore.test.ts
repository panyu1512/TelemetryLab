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

import { useWidgetSelectionStore } from "./useWidgetSelectionStore";

const store = () => useWidgetSelectionStore.getState();

beforeEach(() => {
  const backing = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => void backing.set(k, v),
    removeItem: (k: string) => void backing.delete(k),
    clear: () => backing.clear(),
  };
  useWidgetSelectionStore.setState({ enabled: {} });
  bus.broadcasts.length = 0;
});

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("widget selection", () => {
  it("enables every widget by default", () => {
    expect(store().isEnabled("cluster")).toBe(true);
    expect(store().isEnabled("fuel")).toBe(true);
  });

  it("disables and re-enables a widget independently", () => {
    store().toggle("fuel");
    expect(store().isEnabled("fuel")).toBe(false);
    // Other widgets are unaffected.
    expect(store().isEnabled("cluster")).toBe(true);

    store().toggle("fuel");
    expect(store().isEnabled("fuel")).toBe(true);
  });

  it("persists the selection to localStorage", () => {
    store().toggle("inputs");
    const raw = localStorage.getItem("telemetrylab.widget-selection.v1");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string)).toMatchObject({ inputs: false });
  });
});

describe("cross-window sync", () => {
  it("broadcasts a toggle so an open widget window can hide itself", () => {
    store().toggle("radar");
    expect(bus.broadcasts).toEqual([
      { topic: "widget-selection:changed", payload: { enabled: { radar: false } } },
    ]);
  });

  it("adopts a selection from another window without echoing it", () => {
    bus.handlers["widget-selection:changed"]({ enabled: { fuel: false } });
    expect(store().isEnabled("fuel")).toBe(false);
    expect(store().isEnabled("radar")).toBe(true);
    expect(bus.broadcasts).toHaveLength(0);
  });

  it("drops malformed entries and ignores an empty message", () => {
    bus.handlers["widget-selection:changed"]({
      enabled: { fuel: false, radar: "no" as unknown as boolean },
    });
    expect(store().enabled).toEqual({ fuel: false });
    bus.handlers["widget-selection:changed"](undefined);
    expect(store().enabled).toEqual({ fuel: false });
  });
});
