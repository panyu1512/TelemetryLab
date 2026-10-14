import { describe, expect, it } from "vitest";

import {
  FUEL_HISTORY_LIMIT,
  appendFuelLap,
  closeLap,
  fuelHistoryRows,
  settleLapTime,
  type FuelLap,
  type LapBoundary,
} from "./fuelHistory";

function boundary(over: Partial<LapBoundary> = {}): LapBoundary {
  return {
    lap: 10,
    startFuel: 40,
    endFuel: 37.2,
    startPct: null,
    touchedPit: false,
    ...over,
  };
}

function lap(over: Partial<FuelLap> = {}): FuelLap {
  return {
    lap: 10,
    used: 2.8,
    estimated: false,
    pit: false,
    lapTime: null,
    fuelLeft: 37.2,
    ...over,
  };
}

describe("closeLap", () => {
  it("measures a whole lap as the drop in the tank", () => {
    const l = closeLap(boundary());
    expect(l.lap).toBe(10);
    expect(l.used).toBeCloseTo(2.8, 6);
    expect(l.estimated).toBe(false);
    expect(l.pit).toBe(false);
    expect(l.fuelLeft).toBe(37.2);
    expect(l.lapTime).toBeNull();
  });

  it("scales a part lap up to a whole one, and says so", () => {
    // Watched from 40 % round: 1.68 L over 60 % of the lap is 2.8 L a lap.
    const l = closeLap(boundary({ startPct: 0.4, endFuel: 40 - 1.68 }));
    expect(l.used).toBeCloseTo(2.8, 6);
    expect(l.estimated).toBe(true);
  });

  it("treats an interval that started a hair past the line as whole", () => {
    const l = closeLap(boundary({ startPct: 0.002 }));
    expect(l.estimated).toBe(false);
  });

  it("will not extrapolate from less than half a lap", () => {
    const l = closeLap(boundary({ startPct: 0.6, endFuel: 38.9 }));
    expect(l.used).toBeNull();
    expect(l.estimated).toBe(false);
  });

  it("has nothing to measure from when the start was never seen", () => {
    expect(closeLap(boundary({ startFuel: null })).used).toBeNull();
  });

  it("calls a refill across the line a pit lap with no burn", () => {
    const l = closeLap(boundary({ startFuel: 3, endFuel: 60 }));
    expect(l.used).toBeNull();
    expect(l.pit).toBe(true);
    expect(l.fuelLeft).toBe(60);
  });

  it("ignores a flat tank as noise rather than a refuel", () => {
    const l = closeLap(boundary({ startFuel: 40, endFuel: 40.2 }));
    expect(l.used).toBeNull();
    expect(l.pit).toBe(false);
  });

  it("marks a lap that touched pit road, and still measures it", () => {
    const l = closeLap(boundary({ touchedPit: true }));
    expect(l.pit).toBe(true);
    expect(l.used).toBeCloseTo(2.8, 6);
  });
});

describe("appendFuelLap", () => {
  it("appends without touching the original", () => {
    const before: FuelLap[] = [lap({ lap: 1 })];
    const after = appendFuelLap(before, lap({ lap: 2 }));
    expect(before).toHaveLength(1);
    expect(after.map((l) => l.lap)).toEqual([1, 2]);
  });

  it("drops the oldest laps past the limit", () => {
    let h: FuelLap[] = [];
    for (let i = 1; i <= 5; i++) h = appendFuelLap(h, lap({ lap: i }), 3);
    expect(h.map((l) => l.lap)).toEqual([3, 4, 5]);
  });

  it("keeps a race's worth by default", () => {
    let h: FuelLap[] = [];
    for (let i = 1; i <= FUEL_HISTORY_LIMIT + 7; i++) h = appendFuelLap(h, lap({ lap: i }));
    expect(h).toHaveLength(FUEL_HISTORY_LIMIT);
    expect(h[0].lap).toBe(8);
  });
});

describe("settleLapTime", () => {
  it("gives the newest lap its time", () => {
    const h = settleLapTime([lap({ lap: 4 })], 138.4);
    expect(h[0].lapTime).toBe(138.4);
  });

  it("returns the same array when there is nothing to change", () => {
    const h = [lap({ lap: 4, lapTime: 138.4 })];
    expect(settleLapTime(h, 138.4)).toBe(h);
    expect(settleLapTime(h, null)).toBe(h);
    expect(settleLapTime(h, -1)).toBe(h);
    expect(settleLapTime(h, 0)).toBe(h);
    const empty: FuelLap[] = [];
    expect(settleLapTime(empty, 138.4)).toBe(empty);
  });

  it("ignores the lap before's time still sitting on the channel", () => {
    const h = [lap({ lap: 4, lapTime: 138.4 }), lap({ lap: 5 })];
    expect(settleLapTime(h, 138.4)).toBe(h);
    // …and takes the real one when it lands.
    const settled = settleLapTime(h, 137.9);
    expect(settled[1].lapTime).toBe(137.9);
    expect(settled[0].lapTime).toBe(138.4);
  });

  it("does not mistake a time across a gap in the laps for a stale one", () => {
    // Lap 6 was missed: lap 7 matching lap 5 to the millisecond is its own.
    const h = [lap({ lap: 5, lapTime: 138.4 }), lap({ lap: 7 })];
    expect(settleLapTime(h, 138.4)[1].lapTime).toBe(138.4);
  });

  it("only ever rewrites the newest row", () => {
    const h = [lap({ lap: 4 }), lap({ lap: 5, lapTime: 138 })];
    const settled = settleLapTime(h, 139);
    expect(settled[0]).toBe(h[0]);
    expect(settled[1].lapTime).toBe(139);
  });
});

describe("fuelHistoryRows", () => {
  const history = [
    lap({ lap: 1, used: 2.9 }),
    lap({ lap: 2, used: 2.8 }),
    lap({ lap: 3, used: null, pit: true }),
    lap({ lap: 4, used: 2.85 }),
  ];

  it("lists the newest lap first", () => {
    expect(fuelHistoryRows(history, 2.85).map((r) => r.lap)).toEqual([4, 3, 2, 1]);
  });

  it("grades each burn against the reference", () => {
    const rows = fuelHistoryRows(history, 2.85);
    const by = (n: number) => rows.find((r) => r.lap === n)!;
    expect(by(1).delta).toBeCloseTo(0.05, 6);
    expect(by(1).tone).toBe("higher");
    expect(by(2).delta).toBeCloseTo(-0.05, 6);
    expect(by(2).tone).toBe("lower");
    expect(by(4).delta).toBe(0);
    expect(by(4).tone).toBe("even");
  });

  it("leaves an unmeasured lap ungraded", () => {
    const pit = fuelHistoryRows(history, 2.85).find((r) => r.lap === 3)!;
    expect(pit.delta).toBeNull();
    expect(pit.tone).toBeNull();
    expect(pit.pit).toBe(true);
  });

  it("grades nothing without a reference", () => {
    const rows = fuelHistoryRows(history, null);
    expect(rows.every((r) => r.delta == null && r.tone == null)).toBe(true);
  });

  it("agrees with the printed precision — no red 0.00", () => {
    const [row] = fuelHistoryRows([lap({ used: 2.854 })], 2.85);
    expect(row.delta).toBe(0);
    expect(Object.is(row.delta, -0)).toBe(false);
    expect(row.tone).toBe("even");
    const [under] = fuelHistoryRows([lap({ used: 2.846 })], 2.85);
    expect(Object.is(under.delta, -0)).toBe(false);
    expect(under.tone).toBe("even");
  });
});
