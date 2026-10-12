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

import { clampMinLoss, clampTipCount, useCoachUiStore } from "./useCoachUiStore";

const KEY = "telemetrylab.coach.ui.v1";
const store = () => useCoachUiStore.getState();

beforeEach(() => {
  backing.clear();
  bus.broadcasts.length = 0;
  useCoachUiStore.setState({ minLoss: 0.05, tipCount: 2, showCorners: true, showLapStrip: true });
});

describe("useCoachUiStore", () => {
  it("defaults to a 0.05 s threshold, two tips, corners and strip on", () => {
    expect(store()).toMatchObject({
      minLoss: 0.05,
      tipCount: 2,
      showCorners: true,
      showLapStrip: true,
    });
  });

  it("clamps the threshold and tip count", () => {
    store().setMinLoss(5);
    expect(store().minLoss).toBe(0.3);
    store().setMinLoss(0);
    expect(store().minLoss).toBe(0.02);
    store().setTipCount(9);
    expect(store().tipCount).toBe(3);
    expect(clampMinLoss(Number.NaN)).toBe(0.05);
    expect(clampTipCount(Number.NaN)).toBe(2);
    expect(clampMinLoss(0.123)).toBe(0.12);
  });

  it("persists and broadcasts every change", () => {
    store().setShowLapStrip(false);
    store().setShowCorners(false);
    expect(JSON.parse(backing.get(KEY)!)).toMatchObject({
      showLapStrip: false,
      showCorners: false,
    });
    expect(bus.broadcasts[bus.broadcasts.length - 1]).toEqual({
      topic: "coach-ui:changed",
      payload: expect.objectContaining({ showCorners: false }),
    });
  });

  it("adopts a remote change without echoing it, filling gaps with defaults", () => {
    bus.handlers["coach-ui:changed"]({ tipCount: 3, minLoss: 99 });
    expect(store()).toMatchObject({ tipCount: 3, minLoss: 0.3, showCorners: true });
    expect(bus.broadcasts).toHaveLength(0);
    bus.handlers["coach-ui:changed"](undefined);
    expect(store().tipCount).toBe(3);
  });
});
