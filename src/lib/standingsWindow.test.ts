import { describe, expect, it } from "vitest";

import { leaderCount, sliceGroup } from "./standingsWindow";

const range = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i);

describe("sliceGroup", () => {
  it("shows a group that fits the budget whole", () => {
    expect(sliceGroup(8, 5, 12)).toEqual({ positions: range(0, 8), breakAt: null });
  });

  it("shows everything when uncapped", () => {
    expect(sliceGroup(40, 30, 0)).toEqual({ positions: range(0, 40), breakAt: null });
  });

  it("shows the top of a class the player is not in", () => {
    expect(sliceGroup(20, -1, 4)).toEqual({ positions: range(0, 4), breakAt: null });
  });

  it("stays contiguous while the player is near the front", () => {
    // P6 of 40 with 12 rows: the window around P6 reaches the leaders.
    expect(sliceGroup(40, 5, 12)).toEqual({ positions: range(0, 12), breakAt: null });
  });

  it("keeps the leaders and a window around a midfield player", () => {
    // P21 of 40, 12 rows: 3 leaders, then 9 rows with the player 5th of them.
    const s = sliceGroup(40, 20, 12);
    expect(s.positions).toEqual([0, 1, 2, ...range(16, 25)]);
    expect(s.breakAt).toBe(3);
    expect(s.positions).toContain(20);
    expect(s.positions).toHaveLength(12);
  });

  it("does not run the window past the back of the field", () => {
    const s = sliceGroup(40, 39, 12);
    expect(s.positions).toEqual([0, 1, 2, ...range(31, 40)]);
    expect(s.breakAt).toBe(3);
  });

  it("never exceeds the budget", () => {
    for (let max = 3; max <= 20; max++) {
      for (let p = 0; p < 30; p++) {
        const s = sliceGroup(30, p, max);
        expect(s.positions).toHaveLength(max);
        expect(s.positions).toContain(p);
        expect(new Set(s.positions).size).toBe(max);
      }
    }
  });
});

describe("leaderCount", () => {
  it("scales the leaders with the budget, between 1 and 3", () => {
    expect(leaderCount(3)).toBe(1);
    expect(leaderCount(8)).toBe(2);
    expect(leaderCount(12)).toBe(3);
    expect(leaderCount(30)).toBe(3);
  });
});
