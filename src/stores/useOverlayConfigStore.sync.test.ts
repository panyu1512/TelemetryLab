import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Capture bus traffic + the config subscription so we can assert live
// propagation and simulate a config change arriving from another window.
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

import { useOverlayConfigStore } from "./useOverlayConfigStore";

const broadcasts = bus.broadcasts;
const configHandler = (payload: unknown) => bus.handlers["config:changed"]?.(payload);

const store = () => useOverlayConfigStore.getState();

beforeEach(() => {
  const backing = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => void backing.set(k, v),
    removeItem: (k: string) => void backing.delete(k),
    clear: () => backing.clear(),
  };
  broadcasts.length = 0;
});

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("editor selection persistence", () => {
  it("remembers the last selected overlay", () => {
    store().setLastOverlay("standings");
    expect(store().lastOverlayId).toBe("standings");
  });
});

describe("real-time config propagation", () => {
  it("broadcasts config changes so open overlay windows update live", () => {
    store().setOverlayOpacity("dashboard", 55);
    const msg = broadcasts.find((b) => b.topic === "config:changed");
    expect(msg).toBeDefined();
    const payload = msg!.payload as { profiles: unknown[] };
    expect(Array.isArray(payload.profiles)).toBe(true);
  });

  it("adopts a config change from another window without re-broadcasting", () => {
    expect(configHandler).toBeTypeOf("function");
    broadcasts.length = 0;

    configHandler?.({
      profiles: [
        { id: "remote", name: "Remote", overlays: {} },
      ],
      activeProfileId: "remote",
      globalSettings: {
        themeId: "obsidian",
        bridgeEndpoint: "ws://127.0.0.1:8765",
        logLevel: "info",
        mockDataEnabled: true,
      },
      lastOverlayId: "relative",
    });

    expect(store().activeProfileId).toBe("remote");
    expect(store().globalSettings.mockDataEnabled).toBe(true);
    expect(store().lastOverlayId).toBe("relative");
    // Adopting a remote change must not echo back onto the bus.
    expect(broadcasts).toHaveLength(0);
  });

  it("ignores malformed remote payloads", () => {
    const before = store().activeProfileId;
    configHandler?.({ nonsense: true });
    expect(store().activeProfileId).toBe(before);
  });
});
