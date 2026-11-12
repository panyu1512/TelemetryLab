import { describe, expect, it } from "vitest";

import {
  MAX_PRESETS,
  PRESETS_KEY,
  capturePreset,
  loadPresets,
  planPresetLoad,
  removePreset,
  savePresets,
  upsertPreset,
  type LayoutPreset,
} from "./layoutPresets";
import type { WindowState } from "./windowState";

function mem(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

const STATES: Record<string, WindowState> = {
  "overlay-standings": { bounds: { x: 10, y: 20, width: 800, height: 600 }, locked: true, scale: 1.25 },
  "widget-radar": { bounds: { x: -32000, y: -32000, width: 160, height: 120 }, locked: false },
  "widget-fuel": { locked: false },
};
const stateOf = (l: string) => STATES[l] ?? { locked: false };

describe("capturePreset", () => {
  it("snapshots bounds, scale, lock and open state", () => {
    const p = capturePreset(
      "  Sprint ",
      Object.keys(STATES),
      stateOf,
      (l) => l === "overlay-standings",
      1000,
      "p1"
    );
    expect(p).toMatchObject({ id: "p1", name: "Sprint", savedAt: 1000 });
    expect(p.windows["overlay-standings"]).toEqual({
      bounds: { x: 10, y: 20, width: 800, height: 600 },
      scale: 1.25,
      locked: true,
      open: true,
    });
  });

  it("drops minimized-sentinel bounds and defaults the scale", () => {
    const p = capturePreset("x", ["widget-radar", "widget-fuel"], stateOf, () => false);
    expect(p.windows["widget-radar"].bounds).toBeUndefined();
    expect(p.windows["widget-fuel"]).toEqual({ scale: 1, locked: false, open: false });
  });

  it("names an unnamed preset", () => {
    expect(capturePreset("   ", [], stateOf, () => false).name).toBe("Layout");
  });
});

describe("preset list", () => {
  const a = capturePreset("A", [], stateOf, () => false, 1, "a");
  const b = capturePreset("B", [], stateOf, () => false, 2, "b");

  it("puts new presets first and replaces one with the same name", () => {
    const list = upsertPreset(upsertPreset([], a), b);
    expect(list.map((p) => p.id)).toEqual(["b", "a"]);
    const a2 = capturePreset("a", [], stateOf, () => false, 3, "a2");
    expect(upsertPreset(list, a2).map((p) => p.id)).toEqual(["a2", "b"]);
  });

  it("caps the list", () => {
    let list: LayoutPreset[] = [];
    for (let i = 0; i < MAX_PRESETS + 5; i++) {
      list = upsertPreset(list, capturePreset(`P${i}`, [], stateOf, () => false, i, `p${i}`));
    }
    expect(list).toHaveLength(MAX_PRESETS);
  });

  it("removes by id", () => {
    expect(removePreset([a, b], "a").map((p) => p.id)).toEqual(["b"]);
  });

  it("round-trips through storage and skips malformed entries", () => {
    const s = mem();
    savePresets(s, [a, b]);
    expect(loadPresets(s).map((p) => p.id)).toEqual(["a", "b"]);
    s.setItem(PRESETS_KEY, JSON.stringify([a, { id: 1 }, null]));
    expect(loadPresets(s).map((p) => p.id)).toEqual(["a"]);
    s.setItem(PRESETS_KEY, "{not json");
    expect(loadPresets(s)).toEqual([]);
  });
});

describe("planPresetLoad", () => {
  it("opens, closes and restores only what the preset mentions", () => {
    const p = capturePreset(
      "x",
      ["overlay-standings", "widget-fuel"],
      stateOf,
      (l) => l === "overlay-standings"
    );
    const plan = planPresetLoad(p, new Set(["widget-fuel", "widget-inputs"]));
    expect(plan.open).toEqual(["overlay-standings"]);
    expect(plan.close).toEqual(["widget-fuel"]);
    expect(Object.keys(plan.states)).toEqual(["overlay-standings", "widget-fuel"]);
    expect(plan.states["overlay-standings"]).toEqual({
      bounds: { x: 10, y: 20, width: 800, height: 600 },
      locked: true,
      scale: 1.25,
    });
  });
});
