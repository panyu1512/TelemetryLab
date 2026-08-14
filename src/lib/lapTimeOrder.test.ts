import { describe, expect, it } from "vitest";

import { orderByBestLap } from "./lapTimeOrder";

/** Build a `bestLapOf` lookup from a carIdx → time map. */
function times(map: Record<number, number | null | undefined>) {
  return (idx: number) => map[idx];
}

describe("orderByBestLap", () => {
  it("ranks the fastest lap first", () => {
    const order = orderByBestLap(
      [1, 2, 3],
      times({ 1: 92.5, 2: 91.2, 3: 93.8 }),
    );
    expect(order).toEqual([2, 1, 3]);
  });

  it("sinks cars that have not set a lap, keeping their incoming order", () => {
    // Half a practice field is in the garage at any moment; they still belong
    // on the timesheet, below everyone who has run.
    const order = orderByBestLap(
      [7, 4, 9, 2],
      times({ 7: null, 4: 91.0, 9: undefined, 2: 90.0 }),
    );
    expect(order).toEqual([2, 4, 7, 9]);
  });

  it("treats iRacing's zero and negative sentinels as no lap at all", () => {
    // A lap that was never set comes over as 0 or -1; sorted numerically those
    // would put the entire garage above the session leader.
    const order = orderByBestLap([1, 2, 3], times({ 1: 0, 2: 88.4, 3: -1 }));
    expect(order).toEqual([2, 1, 3]);
  });

  it("ignores non-finite times", () => {
    const order = orderByBestLap(
      [1, 2],
      times({ 1: Number.NaN, 2: 95.1 }),
    );
    expect(order).toEqual([2, 1]);
  });

  it("is stable for cars sharing a time", () => {
    const order = orderByBestLap(
      [5, 3, 8],
      times({ 5: 90.0, 3: 90.0, 8: 90.0 }),
    );
    expect(order).toEqual([5, 3, 8]);
  });

  it("does not mutate the input", () => {
    const input = [3, 1, 2];
    orderByBestLap(input, times({ 1: 90, 2: 91, 3: 92 }));
    expect(input).toEqual([3, 1, 2]);
  });

  it("handles an empty field", () => {
    expect(orderByBestLap([], times({}))).toEqual([]);
  });
});
