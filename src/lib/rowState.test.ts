import { describe, expect, it } from "vitest";

import { rowState } from "./rowState";
import { entry } from "./standingsEntry.fixture";

describe("rowState", () => {
  it("is plain for a car racing", () => {
    expect(rowState(entry(0))).toEqual({
      dsq: false,
      out: false,
      pit: false,
      dimAll: false,
      dimLive: false,
      chips: [],
    });
    expect(rowState(undefined).chips).toEqual([]);
  });

  it("greys only the live timing of a car in the pits", () => {
    const s = rowState(entry(0, { onPitRoad: true }));
    expect(s.chips).toEqual(["pit"]);
    expect(s.dimLive).toBe(true);
    expect(s.dimAll).toBe(false);
    expect(rowState(entry(0, { isInPitStall: true })).chips).toEqual(["pit"]);
  });

  it("greys the whole row of a car that is out, and calls it OUT", () => {
    const s = rowState(entry(0, { isInWorld: false, onPitRoad: true }));
    expect(s.chips).toEqual(["out"]);
    expect(s.pit).toBe(false);
    expect(s.dimAll).toBe(true);
  });

  it("disqualifies by the position block, not a chip, and greys the row", () => {
    const s = rowState(entry(0, { isDisqualified: true, needsRepair: true, onFinalLap: true }));
    expect(s.dsq).toBe(true);
    expect(s.dimAll).toBe(true);
    expect(s.chips).toEqual([]);
  });

  it("shows off track only for a car still in the race", () => {
    expect(rowState(entry(0, { isOffTrack: true })).chips).toEqual(["off"]);
    expect(rowState(entry(0, { isOffTrack: true, onPitRoad: true })).chips).toEqual(["pit"]);
  });

  it("shows the meatball beside any other state", () => {
    expect(rowState(entry(0, { needsRepair: true, onPitRoad: true })).chips).toEqual([
      "pit",
      "repair",
    ]);
  });

  it("shows the final lap, then the finish in its place", () => {
    expect(rowState(entry(0, { onFinalLap: true })).chips).toEqual(["final"]);
    expect(rowState(entry(0, { onFinalLap: true, hasFinished: true })).chips).toEqual([
      "finished",
    ]);
  });
});
