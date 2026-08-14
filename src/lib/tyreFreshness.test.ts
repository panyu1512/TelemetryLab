import { describe, expect, it } from "vitest";

import type { TyreData, TyreSet } from "../telemetry/types";
import {
  advanceTyreAges,
  allCornersStale,
  heldForMs,
  initTyreAges,
  isCornerStale,
  tempKey,
  TYRE_CORNERS,
  TYRE_STALE_AFTER_MS,
} from "./tyreFreshness";

const T0 = 1_700_000_000_000;

function tyre(mid: number): TyreData {
  return { tempL: mid - 3, tempM: mid, tempR: mid + 3, pressure: 168 };
}

/** A four-corner set, optionally offsetting every corner by `bump` degrees. */
function set(bump = 0): TyreSet {
  return {
    lf: tyre(88 + bump),
    rf: tyre(83 + bump),
    lr: tyre(79 + bump),
    rr: tyre(76 + bump),
  };
}

describe("tempKey", () => {
  it("distinguishes corners that differ in any temperature", () => {
    expect(tempKey(tyre(88))).toBe(tempKey(tyre(88)));
    expect(tempKey(tyre(88))).not.toBe(tempKey(tyre(88.1)));
    expect(tempKey({ ...tyre(88), tempR: 99 })).not.toBe(tempKey(tyre(88)));
  });

  it("ignores pressure, which is the static garage figure", () => {
    expect(tempKey({ ...tyre(88), pressure: 999 })).toBe(tempKey(tyre(88)));
  });

  it("is null when the car reports no temperatures at all", () => {
    expect(tempKey(undefined)).toBeNull();
    expect(
      tempKey({ tempL: null, tempM: null, tempR: null, pressure: 168 }),
    ).toBeNull();
  });
});

describe("advanceTyreAges", () => {
  it("starts every corner's clock on the first frame", () => {
    const ages = advanceTyreAges(null, set(), T0);
    for (const c of TYRE_CORNERS) expect(ages[c].since).toBe(T0);
  });

  it("restarts a corner's clock when its temperatures move", () => {
    const first = advanceTyreAges(null, set(), T0);
    const second = advanceTyreAges(first, set(0.1), T0 + 5_000);
    for (const c of TYRE_CORNERS) expect(second[c].since).toBe(T0 + 5_000);
  });

  it("keeps the clock running while the values hold", () => {
    const first = advanceTyreAges(null, set(), T0);
    const second = advanceTyreAges(first, set(), T0 + 5_000);
    const third = advanceTyreAges(second, set(), T0 + 9_000);
    for (const c of TYRE_CORNERS) expect(third[c].since).toBe(T0);
  });

  it("is idempotent for a given frame, so a double render cannot skew it", () => {
    const first = advanceTyreAges(null, set(), T0);
    const held = advanceTyreAges(first, set(), T0 + 5_000);
    expect(advanceTyreAges(held, set(), T0 + 5_000)).toEqual(held);
  });

  it("times each corner independently", () => {
    const first = advanceTyreAges(null, set(), T0);
    // Only the left-front moves.
    const moved = { ...set(), lf: tyre(90) };
    const second = advanceTyreAges(first, moved, T0 + 5_000);
    expect(second.lf.since).toBe(T0 + 5_000);
    expect(second.rf.since).toBe(T0);
  });

  it("resets the clocks when the frame goes away, granting a full grace period", () => {
    const first = advanceTyreAges(null, set(), T0);
    const gone = advanceTyreAges(first, null, T0 + 60_000);
    for (const c of TYRE_CORNERS) expect(gone[c].since).toBe(T0 + 60_000);

    // Data returning is not instantly stale just because it was away a while.
    const back = advanceTyreAges(gone, set(), T0 + 60_100);
    expect(allCornersStale(back, T0 + 60_100)).toBe(false);
  });
});

describe("isCornerStale", () => {
  it("holds off until the threshold, then reports stale", () => {
    const ages = advanceTyreAges(null, set(), T0);
    expect(isCornerStale(ages, "lf", T0 + TYRE_STALE_AFTER_MS - 1)).toBe(false);
    expect(isCornerStale(ages, "lf", T0 + TYRE_STALE_AFTER_MS)).toBe(true);
  });

  it("never calls a corner with no temperatures stale", () => {
    const empty: TyreData = {
      tempL: null,
      tempM: null,
      tempR: null,
      pressure: null,
    };
    const ages = advanceTyreAges(null, { ...set(), lf: empty }, T0);
    const later = T0 + TYRE_STALE_AFTER_MS * 10;
    expect(isCornerStale(ages, "lf", later)).toBe(false);
    expect(isCornerStale(ages, "rf", later)).toBe(true);
  });
});

describe("allCornersStale", () => {
  it("is true only once every corner has frozen — the pit-only signature", () => {
    const ages = advanceTyreAges(null, set(), T0);
    const later = T0 + TYRE_STALE_AFTER_MS;
    expect(allCornersStale(ages, later)).toBe(true);

    // One corner still working means the feed is alive.
    const oneMoving = advanceTyreAges(ages, { ...set(), lf: tyre(90) }, later);
    expect(allCornersStale(oneMoving, later)).toBe(false);
  });

  it("stays false through a normal live stint", () => {
    // A tenth of a degree per second, the rate real carcass temps drift at.
    let ages = initTyreAges(T0);
    for (let i = 0; i <= 120; i++) {
      const now = T0 + i * 1_000;
      ages = advanceTyreAges(ages, set(i * 0.1), now);
      expect(allCornersStale(ages, now)).toBe(false);
    }
  });
});

describe("heldForMs", () => {
  it("reports the shortest hold across the corners", () => {
    const first = advanceTyreAges(null, set(), T0);
    const second = advanceTyreAges(first, { ...set(), lf: tyre(90) }, T0 + 4_000);
    // lf restarted at +4s, the rest have held since T0.
    expect(heldForMs(second, T0 + 10_000)).toBe(6_000);
  });
});
