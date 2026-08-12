import { describe, expect, it } from "vitest";

import type { Equals, Expect } from "./typeAssert";
import type { LapPositioned } from "./relativeLaps";
import { isOffLap, LapRelation, lapDelta, lapRelation, lapTag } from "./relativeLaps";

/** A car at `lap`, `pct` of the way round. */
function car(lap: number | null, pct: number | null = 0): LapPositioned {
  return { lap, lapDistPct: pct };
}

describe("lapDelta", () => {
  it("is zero for cars racing each other on the same lap", () => {
    expect(lapDelta(car(10, 0.5), car(10, 0.52))).toBe(0);
  });

  it("stays zero across the start/finish line", () => {
    // The player has just crossed the line; the car two seconds behind is still
    // completing the previous lap. Same racing lap, lap numbers one apart.
    expect(lapDelta(car(9, 0.99), car(10, 0.01))).toBe(0);
    // And the mirror case: player about to cross, neighbour just did.
    expect(lapDelta(car(10, 0.01), car(9, 0.99))).toBe(0);
  });

  it("reports a full lap down for traffic alongside the player", () => {
    expect(lapDelta(car(9, 0.5), car(10, 0.5))).toBe(-1);
  });

  it("reports a full lap up for a faster car alongside the player", () => {
    expect(lapDelta(car(11, 0.5), car(10, 0.5))).toBe(1);
  });

  it("counts multiple laps", () => {
    expect(lapDelta(car(7, 0.4), car(10, 0.4))).toBe(-3);
  });

  it("is null when either car has no lap yet", () => {
    expect(lapDelta(car(null), car(10, 0.5))).toBeNull();
    expect(lapDelta(car(10, 0.5), car(null))).toBeNull();
  });

  it("falls back to the lap number when distance is unavailable", () => {
    expect(lapDelta(car(9, null), car(10, null))).toBe(-1);
    expect(lapDelta(car(10, null), car(10, null))).toBe(0);
  });

  it("ignores a non-finite distance rather than producing NaN", () => {
    expect(lapDelta(car(10, NaN), car(10, 0.5))).toBe(0);
  });
});

describe("lapRelation", () => {
  it("classifies a same-lap rival", () => {
    expect(lapRelation(car(10, 0.5), car(10, 0.51))).toBe(LapRelation.SameLap);
  });

  it("classifies traffic the player is lapping", () => {
    expect(lapRelation(car(9, 0.5), car(10, 0.5))).toBe(LapRelation.Lapping);
  });

  it("classifies a faster car about to lap the player", () => {
    expect(lapRelation(car(11, 0.5), car(10, 0.5))).toBe(LapRelation.LappedBy);
  });

  it("classifies missing lap data as unknown, never as lapped", () => {
    expect(lapRelation(car(null), car(10, 0.5))).toBe(LapRelation.Unknown);
  });

  it("does not treat a car as lapped merely because both are down on the leader", () => {
    // Both cars are two laps down on a leader on lap 12 — but they are racing
    // each other. Leader-relative `isLapped`/`lapsDown` would say otherwise.
    expect(lapRelation(car(10, 0.3), car(10, 0.32))).toBe(LapRelation.SameLap);
  });
});

describe("isOffLap", () => {
  it("is true in both lapped directions and false otherwise", () => {
    expect(isOffLap(LapRelation.Lapping)).toBe(true);
    expect(isOffLap(LapRelation.LappedBy)).toBe(true);
    expect(isOffLap(LapRelation.SameLap)).toBe(false);
    expect(isOffLap(LapRelation.Unknown)).toBe(false);
  });
});

describe("lapTag", () => {
  it("signs the difference and suffixes L", () => {
    expect(lapTag(1)).toBe("+1L");
    expect(lapTag(-2)).toBe("-2L");
  });

  it("says nothing for same-lap or unknown", () => {
    expect(lapTag(0)).toBeNull();
    expect(lapTag(null)).toBeNull();
  });
});

// ── type-level contracts ─────────────────────────────────────────────────────

/** The union is derived from the const object, so the two cannot drift. */
export type _RelationUnion = Expect<
  Equals<
    LapRelation,
    "same-lap" | "lapping" | "lapped-by" | "unknown"
  >
>;

/** Any lap-positioned record works — callers need not pass a whole entry. */
export type _AcceptsMinimalShape = Expect<
  Equals<LapPositioned, { lap: number | null; lapDistPct: number | null }>
>;
