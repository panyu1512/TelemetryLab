import { describe, expect, it } from "vitest";

import {
  applyDrag,
  cascadePlacement,
  clampOnto,
  clampScale,
  fitMonitor,
  minSizeFor,
  moveToMonitor,
  rescaleBounds,
  snap,
  toCanvas,
} from "./monitorLayout";

const FHD = { x: 0, y: 0, width: 1920, height: 1080 };
const RIGHT = { x: 1920, y: 0, width: 2560, height: 1440 };
const MIN = { width: 160, height: 120 };

describe("fitMonitor / toCanvas", () => {
  it("fits a 16:9 monitor into a wider box, centred horizontally", () => {
    const fit = fitMonitor(FHD, { width: 1000, height: 450 });
    expect(fit.k).toBeCloseTo(450 / 1080);
    expect(fit.height).toBeCloseTo(450);
    expect(fit.offsetY).toBeCloseTo(0);
    expect(fit.offsetX).toBeCloseTo((1000 - 1920 * fit.k) / 2);
  });

  it("maps a window relative to its monitor's origin", () => {
    const fit = fitMonitor(RIGHT, { width: 1280, height: 720 });
    const r = toCanvas({ x: 1920 + 256, y: 144, width: 512, height: 288 }, RIGHT, fit);
    expect(r).toEqual({ x: 128, y: 72, width: 256, height: 144 });
  });
});

describe("snap", () => {
  it("rounds to the grid from an origin", () => {
    expect(snap(37, 16)).toBe(32);
    expect(snap(41, 16)).toBe(48);
    expect(snap(1928, 20, 1920)).toBe(1920);
  });

  it("is a no-op without a step", () => {
    expect(snap(37, 0)).toBe(37);
  });
});

describe("applyDrag", () => {
  const start = { x: 100, y: 100, width: 400, height: 300 };

  it("moves without resizing", () => {
    expect(applyDrag(start, "move", 50, -20, { min: MIN })).toEqual({
      x: 150,
      y: 80,
      width: 400,
      height: 300,
    });
  });

  it("slides a move back onto the monitor", () => {
    const r = applyDrag(start, "move", 5000, -500, { min: MIN, within: FHD });
    expect(r).toEqual({ x: 1520, y: 0, width: 400, height: 300 });
  });

  it("resizes from the south-east corner, keeping the top-left", () => {
    expect(applyDrag(start, "se", 40, 60, { min: MIN })).toEqual({
      x: 100,
      y: 100,
      width: 440,
      height: 360,
    });
  });

  it("resizes from the north-west corner, keeping the bottom-right", () => {
    expect(applyDrag(start, "nw", 50, 30, { min: MIN })).toEqual({
      x: 150,
      y: 130,
      width: 350,
      height: 270,
    });
  });

  it("never resizes below the minimum, and pins the opposite edge", () => {
    const r = applyDrag(start, "nw", 1000, 1000, { min: MIN });
    expect(r.width).toBe(160);
    expect(r.height).toBe(120);
    expect(r.x + r.width).toBe(500);
    expect(r.y + r.height).toBe(400);
  });

  it("stops a resize at the monitor edge", () => {
    const r = applyDrag(start, "e", 5000, 0, { min: MIN, within: FHD });
    expect(r.x + r.width).toBe(1920);
  });

  it("snaps the moved edges to the grid", () => {
    const r = applyDrag(start, "move", 7, 9, { min: MIN, grid: 20 });
    expect(r.x % 20).toBe(0);
    expect(r.y % 20).toBe(0);
    const s = applyDrag(start, "se", 13, 13, { min: MIN, grid: 20 });
    expect((s.x + s.width) % 20).toBe(0);
    expect(s.x).toBe(100);
  });
});

describe("clampOnto", () => {
  it("shrinks an oversized window to the monitor", () => {
    expect(clampOnto({ x: -10, y: -10, width: 4000, height: 2000 }, FHD)).toEqual(FHD);
  });
});

describe("minSizeFor", () => {
  it("scales the logical floor by the DPI factor", () => {
    expect(minSizeFor("widget", 1.5)).toEqual({ width: 240, height: 180 });
    expect(minSizeFor("overlay")).toEqual({ width: 320, height: 200 });
  });
});

describe("cascadePlacement", () => {
  it("staggers windows and keeps them on the monitor", () => {
    const a = cascadePlacement({ width: 320, height: 220 }, 0, FHD);
    const b = cascadePlacement({ width: 320, height: 220 }, 1, FHD);
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.y).toBeGreaterThan(a.y);
    for (let i = 0; i < 40; i++) {
      const r = cascadePlacement({ width: 640, height: 420 }, i, FHD);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(1920);
      expect(r.y + r.height).toBeLessThanOrEqual(1080);
    }
  });
});

describe("rescaleBounds", () => {
  it("grows about the top-left by the scale ratio", () => {
    expect(rescaleBounds({ x: 10, y: 20, width: 400, height: 200 }, 1, 1.25)).toEqual({
      x: 10,
      y: 20,
      width: 500,
      height: 250,
    });
  });
});

describe("moveToMonitor", () => {
  it("keeps the relative position on the target screen", () => {
    const r = moveToMonitor({ x: 960, y: 540, width: 320, height: 220 }, FHD, RIGHT);
    expect(r.x).toBe(1920 + 1280);
    expect(r.y).toBe(720);
  });
});

describe("clampScale", () => {
  it("keeps the scale within 50–200 %", () => {
    expect(clampScale(0.1)).toBe(0.5);
    expect(clampScale(3)).toBe(2);
    expect(clampScale(1.234)).toBe(1.23);
    expect(clampScale(Number.NaN)).toBe(1);
  });
});
