import { describe, expect, it } from "vitest";

import {
  MIN_TABLE_SCALE,
  scaleBox,
  tableScale,
  unscaled,
} from "./tableScale";

describe("tableScale", () => {
  it("draws at full size when the table already fits", () => {
    expect(tableScale(1000, 900)).toBe(1);
    expect(tableScale(900, 900)).toBe(1);
  });

  it("never grows a table to fill a wide window", () => {
    // A wide overlay is a table with room around it, not a table blown up.
    expect(tableScale(4000, 900)).toBe(1);
  });

  it("shrinks in proportion to the room it is short of", () => {
    expect(tableScale(450, 900)).toBeCloseTo(0.5);
    expect(tableScale(720, 900)).toBeCloseTo(0.8);
  });

  it("stops shrinking at the floor rather than scaling into nothing", () => {
    expect(tableScale(90, 900)).toBe(MIN_TABLE_SCALE);
    expect(tableScale(1, 900)).toBe(MIN_TABLE_SCALE);
  });

  it("draws at full size until the first measurement lands", () => {
    // One frame of "show everything and let it clip", the same default the
    // session strip takes.
    expect(tableScale(0, 900)).toBe(1);
    expect(tableScale(Number.NaN, 900)).toBe(1);
    expect(tableScale(-10, 900)).toBe(1);
  });

  it("draws at full size when the table wants no room at all", () => {
    expect(tableScale(500, 0)).toBe(1);
    expect(tableScale(500, Number.NaN)).toBe(1);
  });

  it("is monotonic in the width available", () => {
    const widths = [100, 300, 500, 700, 900, 1100];
    const scales = widths.map((w) => tableScale(w, 900));
    for (let i = 1; i < scales.length; i++) {
      expect(scales[i]).toBeGreaterThanOrEqual(scales[i - 1]);
    }
  });
});

describe("unscaled", () => {
  it("converts a window length into the table's own coordinates", () => {
    // At half scale, 400 window px is 800 px of room to draw in — which is the
    // width the strip and the class band must be told, or they shed fields at
    // the very sizes this scaling exists to keep them at.
    expect(unscaled(400, 0.5)).toBe(800);
    expect(unscaled(400, 1)).toBe(400);
  });

  it("round-trips against the scale it came from", () => {
    const scale = tableScale(600, 900);
    expect(unscaled(600, scale) * scale).toBeCloseTo(600);
  });

  it("passes the length through rather than dividing by zero", () => {
    expect(unscaled(400, 0)).toBe(400);
  });
});

describe("scaleBox", () => {
  it("zooms rather than transforming, so the type is re-laid out not resampled", () => {
    expect(scaleBox(0.75)).toMatchObject({ zoom: 0.75 });
    expect(scaleBox(0.75)).not.toHaveProperty("transform");
  });

  it("publishes the scale so held sizes can divide it back out", () => {
    expect(scaleBox(0.75)).toMatchObject({ "--table-scale": 0.75 });
  });
});
