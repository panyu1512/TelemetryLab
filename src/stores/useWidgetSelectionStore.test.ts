import { afterEach, beforeEach, describe, expect, it } from "vitest";

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
