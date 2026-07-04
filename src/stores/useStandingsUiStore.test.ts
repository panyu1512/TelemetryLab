import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The store broadcasts column/view changes over the bus; stub it so the tests
// stay isolated (and so importing the store doesn't need a real transport).
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

import { useStandingsUiStore } from "./useStandingsUiStore";

const store = () => useStandingsUiStore.getState();

beforeEach(() => {
  const backing = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => void backing.set(k, v),
    removeItem: (k: string) => void backing.delete(k),
    clear: () => backing.clear(),
  };
  bus.broadcasts.length = 0;
  useStandingsUiStore.setState({ columns: {} });
});

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("standings column configuration", () => {
  it("shows every column by default", () => {
    expect(store().isColumnVisible("irating")).toBe(true);
    expect(store().isColumnVisible("sectors")).toBe(true);
  });

  it("toggles a column off and back on", () => {
    store().toggleColumn("irating");
    expect(store().isColumnVisible("irating")).toBe(false);
    // Other columns are unaffected.
    expect(store().isColumnVisible("gap")).toBe(true);

    store().toggleColumn("irating");
    expect(store().isColumnVisible("irating")).toBe(true);
  });

  it("broadcasts changes so an open standings window updates live", () => {
    store().toggleColumn("tire");
    expect(bus.broadcasts.some((b) => b.topic === "standings-ui:changed")).toBe(
      true
    );
  });

  it("resets all columns back to visible", () => {
    store().toggleColumn("best");
    store().toggleColumn("last");
    expect(store().isColumnVisible("best")).toBe(false);

    store().resetColumns();
    expect(store().isColumnVisible("best")).toBe(true);
    expect(store().isColumnVisible("last")).toBe(true);
  });

  it("adopts a view change from another window without echoing", () => {
    bus.broadcasts.length = 0;
    bus.handlers["standings-ui:changed"]?.({
      grouping: "overall",
      collapsed: {},
      classFilter: null,
      followPlayer: false,
      columns: { irating: false },
    });
    expect(store().grouping).toBe("overall");
    expect(store().isColumnVisible("irating")).toBe(false);
    // Applying a remote change must not re-broadcast.
    expect(bus.broadcasts).toHaveLength(0);
  });
});
