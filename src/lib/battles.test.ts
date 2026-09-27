import { describe, expect, it } from "vitest";

import { classBattles, isRacing, overallBattles, sameSet } from "./battles";
import { entry } from "./standingsEntry.fixture";

function field(...entries: ReturnType<typeof entry>[]) {
  return Object.fromEntries(entries.map((e) => [e.carIdx, e]));
}

describe("isRacing", () => {
  it("is a car on track, in the world, off pit road", () => {
    expect(isRacing(entry(0))).toBe(true);
  });

  it("excludes the pits, the parked, the disqualified and the finished", () => {
    expect(isRacing(entry(0, { onPitRoad: true }))).toBe(false);
    expect(isRacing(entry(0, { isInPitStall: true }))).toBe(false);
    expect(isRacing(entry(0, { isInWorld: false }))).toBe(false);
    expect(isRacing(entry(0, { isRetired: true }))).toBe(false);
    expect(isRacing(entry(0, { isDisqualified: true }))).toBe(false);
    expect(isRacing(entry(0, { hasFinished: true }))).toBe(false);
    expect(isRacing(undefined)).toBe(false);
  });
});

describe("classBattles", () => {
  it("flags the chasing car within a second of the car ahead in class", () => {
    const f = field(entry(0), entry(1, { classInterval: 0.4 }), entry(2, { classInterval: 3.2 }));
    expect([...classBattles([[0, 1, 2]], f)]).toEqual([1]);
  });

  it("measures the gap as printed — +1.0 is not within a second", () => {
    const f = field(entry(0), entry(1, { classInterval: 0.96 }), entry(2, { classInterval: 0.94 }));
    expect([...classBattles([[0, 1, 2]], f)]).toEqual([2]);
  });

  it("is not a fight when either car is not racing", () => {
    const pitAhead = field(entry(0, { onPitRoad: true }), entry(1, { classInterval: 0.3 }));
    const outBehind = field(entry(0), entry(1, { classInterval: 0.3, isInWorld: false }));
    expect(classBattles([[0, 1]], pitAhead).size).toBe(0);
    expect(classBattles([[0, 1]], outBehind).size).toBe(0);
  });

  it("ignores a lapped car's interval", () => {
    const f = field(entry(0), entry(1, { classInterval: 0.2, classGapIsLaps: true }));
    expect(classBattles([[0, 1]], f).size).toBe(0);
  });

  it("never flags a class leader", () => {
    const f = field(entry(0, { classInterval: 0 }), entry(1, { classInterval: 5 }));
    expect(classBattles([[0, 1]], f).has(0)).toBe(false);
  });
});

describe("overallBattles", () => {
  it("only counts a car of the same class directly ahead", () => {
    const f = field(
      entry(0, { carClassId: 1 }),
      entry(1, { carClassId: 2, interval: 0.3 }), // traffic, not a fight
      entry(2, { carClassId: 2, interval: 0.5 }), // chasing the GT4 ahead
    );
    expect([...overallBattles([0, 1, 2], f)]).toEqual([2]);
  });

  it("ignores a lapped car", () => {
    const f = field(entry(0), entry(1, { interval: 0.2, gapIsLaps: true }));
    expect(overallBattles([0, 1], f).size).toBe(0);
  });
});

describe("sameSet", () => {
  it("compares members, not order or identity", () => {
    expect(sameSet(new Set([1, 2]), new Set([2, 1]))).toBe(true);
    expect(sameSet(new Set([1, 2]), new Set([1]))).toBe(false);
    expect(sameSet(new Set([1, 2]), new Set([1, 3]))).toBe(false);
  });
});
