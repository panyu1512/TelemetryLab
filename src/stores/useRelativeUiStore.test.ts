import { beforeEach, describe, expect, it, vi } from "vitest";

// The store broadcasts its options over the bus; stub it so the tests stay
// isolated (and so importing the store doesn't need a real transport).
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

const backing = vi.hoisted(() => new Map<string, string>());
vi.hoisted(() => {
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => void backing.set(k, v),
    removeItem: (k: string) => void backing.delete(k),
    clear: () => backing.clear(),
  };
});

import { useRelativeUiStore } from "./useRelativeUiStore";

const KEY = "telemetrylab.relative.ui.v1";
const store = () => useRelativeUiStore.getState();

beforeEach(() => {
  backing.clear();
  bus.broadcasts.length = 0;
  useRelativeUiStore.setState({ showLicense: true, showIRating: true });
});

describe("useRelativeUiStore — licence and iRating", () => {
  it("shows both by default", () => {
    expect(store().showLicense).toBe(true);
    expect(store().showIRating).toBe(true);
  });

  it("persists and broadcasts each toggle", () => {
    store().setShowIRating(false);
    expect(JSON.parse(backing.get(KEY)!)).toMatchObject({
      showIRating: false,
      showLicense: true,
    });
    store().setShowLicense(false);
    expect(bus.broadcasts[bus.broadcasts.length - 1]).toEqual({
      topic: "relative-ui:changed",
      payload: expect.objectContaining({
        showLicense: false,
        showIRating: false,
      }),
    });
  });

  it("adopts a remote change, and keeps them on for a sender that predates them", () => {
    bus.handlers["relative-ui:changed"]({ showIRating: false });
    expect(store().showIRating).toBe(false);
    expect(store().showLicense).toBe(true);
    // Applying a remote update must not echo it back out.
    expect(bus.broadcasts).toHaveLength(0);
  });
});
