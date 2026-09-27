import { describe, expect, it } from "vitest";

import { lapTrend, TREND_LAPS } from "./lapTrend";

const xs = (points: string) => points.split(" ").map((p) => Number(p.split(",")[0]));
const ys = (points: string) => points.split(" ").map((p) => Number(p.split(",")[1]));

describe("lapTrend", () => {
  it("draws nothing without a lap", () => {
    expect(lapTrend([], 90)).toBeNull();
    expect(lapTrend(undefined, 90)).toBeNull();
    expect(lapTrend([-1, 0, Number.NaN], 90)).toBeNull();
  });

  it("holds the last five laps, oldest on the left", () => {
    const g = lapTrend([91, 92, 93, 94, 95, 96, 97], 90)!;
    expect(xs(g.points)).toHaveLength(TREND_LAPS);
    // 97 is the newest and the slowest, so it ends the line, highest up.
    expect(g.last.y).toBe(Math.min(...ys(g.points)));
  });

  it("always ends the line at the right-hand edge, however few laps there are", () => {
    const full = lapTrend([91, 91, 91, 91, 91], 91)!;
    const two = lapTrend([91, 92], 91)!;
    expect(two.last.x).toBe(full.last.x);
    expect(xs(two.points)).toHaveLength(2);
  });

  it("plots slower laps higher up, measured against the car's best", () => {
    const g = lapTrend([90.1, 91.5], 90)!;
    const [older, newer] = ys(g.points);
    expect(newer).toBeLessThan(older);
    // The dotted line is the best lap, below both of these.
    expect(g.baselineY).toBeGreaterThan(older);
  });

  it("uses one fixed scale for every row, clamped at both ends", () => {
    const tiny = lapTrend([90.0, 90.1], 90)!;
    const huge = lapTrend([90.0, 110], 90)!;
    // A tenth barely moves; twenty seconds pins to the top rather than off it.
    expect(ys(tiny.points)[0] - ys(tiny.points)[1]).toBeLessThan(1);
    expect(huge.last.y).toBeGreaterThanOrEqual(0);
    expect(lapTrend([80], 90)!.last.y).toBeLessThanOrEqual(18);
  });

  it("falls back to its own quickest lap when there is no best", () => {
    const g = lapTrend([92, 91, 93], null)!;
    expect(ys(g.points)[1]).toBe(g.baselineY);
  });

  it("reads the laps out for a screen reader", () => {
    expect(lapTrend([91.5, 92.25], 90)!.label).toBe("Last 2 laps: 1:31.500, 1:32.250");
    expect(lapTrend([91.5], 90)!.label).toBe("Last 1 lap: 1:31.500");
  });
});
