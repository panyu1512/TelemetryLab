import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Capture bus traffic and the store's own lock subscription so we can assert
// propagation and simulate a lock change arriving from another window.
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

import { useWindowStore, WINDOW_LABEL } from "./useWindowStore";
import { isWindowLocked } from "../lib/windowState";

const broadcasts = bus.broadcasts;
const lockHandler = (payload: unknown) => bus.handlers["window:lock"]?.(payload);

beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  broadcasts.length = 0;
  useWindowStore.setState({ overlayMode: false, locks: {} });
});

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("window locking", () => {
  it("runs in the main window by default", () => {
    expect(WINDOW_LABEL).toBe("main");
  });

  it("locks an extra overlay window individually and persists it", () => {
    useWindowStore.getState().setLock("overlay-standings", true);

    expect(useWindowStore.getState().isLocked("overlay-standings")).toBe(true);
    expect(isWindowLocked("overlay-standings")).toBe(true);
    // A sibling window is unaffected.
    expect(useWindowStore.getState().isLocked("overlay-relative")).toBe(false);
  });

  it("broadcasts every lock change so open windows react in real time", () => {
    useWindowStore.getState().setLock("overlay-standings", true);
    expect(broadcasts).toContainEqual({
      topic: "window:lock",
      payload: { label: "overlay-standings", locked: true },
    });
  });

  it("main and extra windows use the same locking mechanism", () => {
    const { setLock, isLocked } = useWindowStore.getState();
    setLock("main", true);
    setLock("overlay-standings", true);
    expect(isLocked("main")).toBe(true);
    expect(isLocked("overlay-standings")).toBe(true);
    // Both went through the same broadcast path.
    expect(broadcasts.map((b) => (b.payload as { label: string }).label)).toEqual([
      "main",
      "overlay-standings",
    ]);
  });

  it("adopts a lock change arriving from another window without echoing", () => {
    expect(lockHandler).toBeTypeOf("function");
    lockHandler?.({ label: "widget-fuel", locked: true });

    expect(useWindowStore.getState().isLocked("widget-fuel")).toBe(true);
    // Applying a remote change must not re-broadcast (no feedback loop).
    expect(broadcasts).toHaveLength(0);
  });

  it("only lets the main window lock while it is an overlay", () => {
    const store = useWindowStore.getState();
    // Not in overlay mode → toggling the main window is a no-op.
    store.toggleLock();
    expect(useWindowStore.getState().isLocked("main")).toBe(false);

    store.setOverlayMode(true);
    useWindowStore.getState().toggleLock();
    expect(useWindowStore.getState().isLocked("main")).toBe(true);
  });

  it("clears the main window lock when leaving overlay mode", () => {
    const store = useWindowStore.getState();
    store.setOverlayMode(true);
    useWindowStore.getState().setLock("main", true);
    expect(useWindowStore.getState().isLocked("main")).toBe(true);

    useWindowStore.getState().setOverlayMode(false);
    expect(useWindowStore.getState().isLocked("main")).toBe(false);
    expect(isWindowLocked("main")).toBe(false);
  });
});
