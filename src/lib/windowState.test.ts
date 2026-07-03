import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getWindowBounds,
  getWindowState,
  isWindowLocked,
  patchWindowState,
  saveWindowBounds,
  saveWindowLock,
} from "./windowState";

// Minimal in-memory localStorage for the node test environment.
beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
});

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("windowState", () => {
  it("defaults to unlocked with no bounds", () => {
    expect(getWindowState("main")).toEqual({ locked: false });
    expect(getWindowBounds("main")).toBeUndefined();
    expect(isWindowLocked("main")).toBe(false);
  });

  it("persists bounds and lock independently per window label", () => {
    saveWindowBounds("overlay-standings", { x: 100, y: 200, width: 640, height: 420 });
    saveWindowLock("overlay-standings", true);

    // The other window is untouched — no bleed between labels.
    expect(getWindowBounds("widget-fuel")).toBeUndefined();
    expect(isWindowLocked("widget-fuel")).toBe(false);

    const s = getWindowState("overlay-standings");
    expect(s.bounds).toEqual({ x: 100, y: 200, width: 640, height: 420 });
    expect(s.locked).toBe(true);
  });

  it("locking a window does not reset its saved position/size (close→reopen)", () => {
    saveWindowBounds("overlay-relative", { x: 10, y: 20, width: 300, height: 300 });
    // Simulate a lock toggle while the window is open…
    saveWindowLock("overlay-relative", true);
    // …then a close+reopen: bounds are still exactly where they were.
    expect(getWindowBounds("overlay-relative")).toEqual({
      x: 10,
      y: 20,
      width: 300,
      height: 300,
    });
    expect(isWindowLocked("overlay-relative")).toBe(true);
  });

  it("state survives an application restart (re-reads persisted storage)", () => {
    saveWindowBounds("main", { x: 5, y: 6, width: 800, height: 600 });
    saveWindowLock("main", true);
    // A "restart" is just a fresh read of the same backing store.
    expect(getWindowState("main")).toEqual({
      bounds: { x: 5, y: 6, width: 800, height: 600 },
      locked: true,
    });
  });

  it("patchWindowState merges without dropping sibling fields", () => {
    saveWindowBounds("overlay-dashboard", { x: 1, y: 2, width: 3, height: 4 });
    patchWindowState("overlay-dashboard", { locked: true });
    expect(getWindowState("overlay-dashboard")).toEqual({
      bounds: { x: 1, y: 2, width: 3, height: 4 },
      locked: true,
    });
  });
});
