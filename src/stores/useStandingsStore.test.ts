import { beforeEach, describe, expect, it } from "vitest";

import { mockStandings } from "../lib/mockData";
import { useStandingsStore } from "./useStandingsStore";

/** Best lap of a car, from the store's current snapshot. */
function bestOf(carIdx: number): number | null {
  return useStandingsStore.getState().byIdx[carIdx].bestLapTime;
}

describe("useStandingsStore — bestLapOrder", () => {
  beforeEach(() => useStandingsStore.getState().clear());

  it("ranks the whole field by best lap, fastest first", () => {
    useStandingsStore.getState().setStandings(mockStandings(400), 1);
    const order = useStandingsStore.getState().bestLapOrder;

    expect(order).toHaveLength(useStandingsStore.getState().order.length);
    const timed = order.map(bestOf).filter((t): t is number => t != null && t > 0);
    expect(timed).toEqual([...timed].sort((a, b) => a - b));
  });

  it("holds every car in the field, not just the timed ones", () => {
    useStandingsStore.getState().setStandings(mockStandings(400), 1);
    const { order, bestLapOrder } = useStandingsStore.getState();
    expect([...bestLapOrder].sort()).toEqual([...order].sort());
  });

  /*
   * The identity contract, and the reason this order is computed in the store
   * at all. `useStandingsLayout` memoizes on the order array rather than on row
   * data so it reruns when cars change places, not ten times a second — which
   * only holds if an unchanged ranking keeps the same array.
   */
  it("keeps the same array when the ranking has not changed", () => {
    const payload = mockStandings(400);
    useStandingsStore.getState().setStandings(payload, 1);
    const first = useStandingsStore.getState().bestLapOrder;

    useStandingsStore.getState().setStandings(payload, 2);
    expect(useStandingsStore.getState().bestLapOrder).toBe(first);
  });

  it("replaces the array once the ranking does change", () => {
    const payload = mockStandings(400);
    useStandingsStore.getState().setStandings(payload, 1);
    const first = useStandingsStore.getState().bestLapOrder;

    // Hand the car currently last on the timesheet a session-leading lap.
    const slowest = first[first.length - 1];
    const faster = {
      ...payload,
      entries: payload.entries.map((e) =>
        e.carIdx === slowest ? { ...e, bestLapTime: 1 } : e,
      ),
    };
    useStandingsStore.getState().setStandings(faster, 2);

    const next = useStandingsStore.getState().bestLapOrder;
    expect(next).not.toBe(first);
    expect(next[0]).toBe(slowest);
  });

  it("clears with the rest of the field", () => {
    useStandingsStore.getState().setStandings(mockStandings(400), 1);
    useStandingsStore.getState().clear();
    expect(useStandingsStore.getState().bestLapOrder).toEqual([]);
  });
});
