import { describe, expect, it } from "vitest";

import { computeFuelStrategy, type FuelInputs } from "./fuelStrategy";

/** A fully-null baseline; individual tests override just what they exercise. */
function inputs(over: Partial<FuelInputs> = {}): FuelInputs {
  return {
    fuelLevel: null,
    tankCapacity: null,
    perLap: null,
    avgLapTime: null,
    currentLap: null,
    stintStartLap: null,
    lapsRemaining: null,
    timeRemaining: null,
    isTimed: false,
    marginLaps: 1,
    pitFuel: null,
    ...over,
  };
}

describe("computeFuelStrategy — degenerate inputs", () => {
  it("never throws and calibrates on an all-null snapshot", () => {
    const s = computeFuelStrategy(inputs());
    expect(s.status).toBe("calibrating");
    expect(s.perLap).toBeNull();
    expect(s.lapsToFinish).toBeNull();
    expect(s.plans).toEqual([]);
  });

  it("reports empty when the tank is essentially dry", () => {
    const s = computeFuelStrategy(inputs({ fuelLevel: 0.2, perLap: 2.5 }));
    expect(s.status).toBe("empty");
  });

  it("stays calibrating without a per-lap burn even with fuel", () => {
    const s = computeFuelStrategy(inputs({ fuelLevel: 50, tankCapacity: 100 }));
    expect(s.status).toBe("calibrating");
  });
});

describe("computeFuelStrategy — the AutoFuel margin", () => {
  it("prices the margin in laps at the current burn", () => {
    const s = computeFuelStrategy(
      inputs({ fuelLevel: 50, tankCapacity: 100, marginLaps: 1, perLap: 2.5 }),
    );
    expect(s.fuelPct).toBeCloseTo(0.5, 6);
    expect(s.reserve).toBeCloseTo(2.5, 6); // 1 lap x 2.5 L/lap
  });

  it("scales the reserve with the margin", () => {
    const two = computeFuelStrategy(
      inputs({ fuelLevel: 50, tankCapacity: 100, marginLaps: 2, perLap: 2.5 }),
    );
    expect(two.reserve).toBeCloseTo(5, 6);
  });

  it("ignores tank capacity — a lap costs the same in any tank", () => {
    const small = computeFuelStrategy(
      inputs({ fuelLevel: 30, tankCapacity: 40, marginLaps: 1, perLap: 2 }),
    );
    const big = computeFuelStrategy(
      inputs({ fuelLevel: 30, tankCapacity: 120, marginLaps: 1, perLap: 2 }),
    );
    expect(small.reserve).toBeCloseTo(2, 6);
    expect(big.reserve).toBeCloseTo(2, 6);
  });

  it("holds no reserve until a lap has been sampled", () => {
    // AutoFuel says the same: "we do not have fuel data for you. Run some laps".
    const s = computeFuelStrategy(
      inputs({ fuelLevel: 40, tankCapacity: 100, marginLaps: 1, perLap: null }),
    );
    expect(s.reserve).toBeNull();
    expect(s.lapsOfFuelSafe).toBeNull();
    expect(s.status).toBe("calibrating");
  });

  it("floors the margin at one lap in a timed race", () => {
    // iRacing: do not go below 1.0 in a time-limited race, because the race
    // can run a lap longer than anyone predicted.
    const s = computeFuelStrategy(
      inputs({
        fuelLevel: 50,
        tankCapacity: 100,
        marginLaps: 0.25,
        perLap: 2,
        isTimed: true,
        timeRemaining: 600,
        avgLapTime: 60,
      }),
    );
    expect(s.reserve).toBeCloseTo(2, 6); // 1 lap, not 0.25
  });

  it("honours a sub-lap margin when the lap count cannot move", () => {
    const s = computeFuelStrategy(
      inputs({
        fuelLevel: 50,
        tankCapacity: 100,
        marginLaps: 0.25,
        perLap: 2,
        isTimed: false,
        lapsRemaining: 10,
      }),
    );
    expect(s.reserve).toBeCloseTo(0.5, 6);
  });

  it("treats a negative margin as none", () => {
    const s = computeFuelStrategy(
      inputs({ fuelLevel: 50, tankCapacity: 100, marginLaps: -3, perLap: 2 }),
    );
    expect(s.reserve).toBe(0);
  });

  it("clamps the fuel fraction to [0,1]", () => {
    const over = computeFuelStrategy(
      inputs({ fuelLevel: 120, tankCapacity: 100, perLap: 2 }),
    );
    expect(over.fuelPct).toBe(1);
  });

  it("still reserves when capacity is unknown", () => {
    const s = computeFuelStrategy(
      inputs({ fuelLevel: 40, tankCapacity: null, marginLaps: 1, perLap: 2 }),
    );
    expect(s.reserve).toBeCloseTo(2, 6);
    expect(s.fuelPct).toBeNull();
    expect(s.stintLength).toBeNull();
  });
});

describe("computeFuelStrategy — laps to the flag", () => {
  it("uses the lap-limited remaining count", () => {
    const s = computeFuelStrategy(
      inputs({ fuelLevel: 50, tankCapacity: 100, perLap: 2, lapsRemaining: 12 }),
    );
    expect(s.lapsToFinish).toBe(12);
  });

  it("estimates laps from time in a timed race", () => {
    const s = computeFuelStrategy(
      inputs({
        fuelLevel: 50,
        tankCapacity: 100,
        perLap: 2,
        isTimed: true,
        timeRemaining: 305,
        avgLapTime: 60,
      }),
    );
    // ceil(305 / 60) = 6
    expect(s.lapsToFinish).toBe(6);
  });

  it("prefers an explicit lap count over the timed estimate", () => {
    const s = computeFuelStrategy(
      inputs({
        perLap: 2,
        fuelLevel: 50,
        lapsRemaining: 8,
        isTimed: true,
        timeRemaining: 6000,
        avgLapTime: 60,
      }),
    );
    expect(s.lapsToFinish).toBe(8);
  });
});

describe("computeFuelStrategy — finish prediction", () => {
  const finishing = inputs({
    fuelLevel: 50,
    tankCapacity: 100,
    perLap: 2.5,
    marginLaps: 1,
    lapsRemaining: 10,
    currentLap: 5,
    stintStartLap: 1,
  });

  it("flags a comfortable finish", () => {
    const s = computeFuelStrategy(finishing);
    expect(s.status).toBe("finish");
    expect(s.finishesOnFuel).toBe(true);
    expect(s.fuelToFinish).toBeCloseTo(25, 6);
    expect(s.fuelDelta).toBeCloseTo(22.5, 6); // usable 47.5 − 25
    expect(s.surplusLaps).toBe(9); // floor(19 − 10)
  });

  it("recommends no stop when the fuel already lasts", () => {
    const s = computeFuelStrategy(finishing);
    expect(s.plans).toHaveLength(1);
    expect(s.plans[0].stops).toBe(0);
    expect(s.plans[0].label).toBe("No stop");
  });

  it("computes laps of fuel (raw and safe)", () => {
    const s = computeFuelStrategy(finishing);
    expect(s.lapsOfFuel).toBeCloseTo(20, 6); // 50 / 2.5
    expect(s.lapsOfFuelSafe).toBeCloseTo(19, 6); // 47.5 / 2.5
  });
});

describe("computeFuelStrategy — fuel save vs. mandatory pit", () => {
  it("suggests a save when the deficit is small (≤15%)", () => {
    // usable 18 L (20 − a 1-lap, 2 L margin) vs 20 L needed → save ≈ 10%.
    const s = computeFuelStrategy(
      inputs({
        fuelLevel: 20,
        tankCapacity: 100,
        perLap: 2,
        lapsRemaining: 10,
      }),
    );
    expect(s.finishesOnFuel).toBe(false);
    expect(s.saveNeededPct).toBeGreaterThan(0);
    expect(s.saveNeededPct!).toBeLessThanOrEqual(0.15);
    expect(s.status).toBe("save");
  });

  it("requires a stop when the deficit is large", () => {
    const s = computeFuelStrategy(
      inputs({
        fuelLevel: 10,
        tankCapacity: 100,
        perLap: 2.5,
        lapsRemaining: 20,
        currentLap: 3,
      }),
    );
    expect(s.status).toBe("pit");
    expect(s.finishesOnFuel).toBe(false);
    expect(s.plans[0].stops).toBeGreaterThanOrEqual(1);
  });
});

describe("computeFuelStrategy — stint & pit window", () => {
  const s = computeFuelStrategy(
    inputs({
      fuelLevel: 50,
      tankCapacity: 100,
      perLap: 2.5,
      lapsRemaining: 10,
      currentLap: 8,
      stintStartLap: 3,
    }),
  );

  it("reports stint length from the usable tank", () => {
    expect(s.stintLength).toBe(39); // floor(97.5 / 2.5)
  });

  it("tracks laps used this stint", () => {
    expect(s.stintUsed).toBe(5); // 8 − 3
  });

  it("derives the must-pit-by countdown and window", () => {
    expect(s.pitInLaps).toBe(19); // floor(47.5 / 2.5)
    expect(s.recommendedPitLap).toBe(27); // 8 + 19
    expect(s.pitWindow).toEqual([26, 27]);
  });
});

describe("computeFuelStrategy — multi-stop planning", () => {
  it("produces a greedy primary plan plus an even alternative", () => {
    const s = computeFuelStrategy(
      inputs({
        fuelLevel: 20,
        tankCapacity: 40,
        perLap: 2,
        lapsRemaining: 60,
        currentLap: 1,
      }),
    );
    expect(s.plans.length).toBeGreaterThanOrEqual(1);
    const primary = s.plans[0];
    expect(primary.stops).toBeGreaterThanOrEqual(1);
    // pitLaps and addFuel arrays stay in lockstep.
    expect(primary.pitLaps).toHaveLength(primary.stops);
    expect(primary.addFuel).toHaveLength(primary.stops);
    if (s.plans.length > 1) {
      expect(s.plans[1].stops).not.toBe(primary.stops);
    }
  });

  it("honours a fixed pit-fuel override at each stop", () => {
    const s = computeFuelStrategy(
      inputs({
        fuelLevel: 20,
        tankCapacity: 40,
        perLap: 2,
        lapsRemaining: 40,
        currentLap: 1,
        pitFuel: 15,
      }),
    );
    // Every fill is capped at the 15 L override.
    for (const add of s.plans[0].addFuel) {
      expect(add).toBeLessThanOrEqual(15 + 1e-9);
    }
  });
});
