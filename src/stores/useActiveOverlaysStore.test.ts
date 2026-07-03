import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Capture bus traffic + the store's windows:changed subscription so we can
// assert open/close broadcasts and simulate a change from another window.
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

import { useActiveOverlaysStore } from "./useActiveOverlaysStore";
import { rememberWindow } from "../lib/overlayWindows";

const store = () => useActiveOverlaysStore.getState();

beforeEach(() => {
  const backing = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => void backing.set(k, v),
    removeItem: (k: string) => void backing.delete(k),
    clear: () => backing.clear(),
  };
  bus.broadcasts.length = 0;
  useActiveOverlaysStore.setState({ windows: [] });
});

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("active overlays (manager as single source of truth)", () => {
  it("opens an overlay and tracks it as active", () => {
    expect(store().isOverlayOpen("standings")).toBe(false);
    store().openOverlay("standings", "Standings");
    expect(store().isOverlayOpen("standings")).toBe(true);
    // Persisted + announced so other windows can react.
    expect(bus.broadcasts.some((b) => b.topic === "windows:changed")).toBe(true);
  });

  it("closes an overlay and stops tracking it", () => {
    store().openOverlay("relative", "Relative");
    expect(store().isOverlayOpen("relative")).toBe(true);

    store().closeOverlay("relative");
    expect(store().isOverlayOpen("relative")).toBe(false);
  });

  it("tracks overlays independently", () => {
    store().openOverlay("dashboard", "Dashboard");
    store().openOverlay("fuel", "Fuel Calc");
    expect(store().isOverlayOpen("dashboard")).toBe(true);
    expect(store().isOverlayOpen("fuel")).toBe(true);
    expect(store().isOverlayOpen("standings")).toBe(false);
  });

  it("refreshes from persistence when another window changes the open set", () => {
    expect(store().isOverlayOpen("standings")).toBe(false);
    // Another window (e.g. restore-on-launch, or an overlay closing itself)
    // mutates the shared open-window set, then the bus fires.
    rememberWindow({ kind: "overlay", id: "standings", label: "Standings" });
    bus.handlers["windows:changed"]?.(null);
    expect(store().isOverlayOpen("standings")).toBe(true);
  });
});
