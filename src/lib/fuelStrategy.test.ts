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
    reservePct: 0.05,
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

describe("computeFuelStrategy — tank & reserve maths", () => {
  it("computes fuel fraction and reserve from tank capacity", () => {
    const s = computeFuelStrategy(
      inputs({ fuelLevel: 50, tankCapacity: 100, reservePct: 0.05, perLap: 2.5 }),
    );
    expect(s.fuelPct).toBeCloseTo(0.5, 6);
    expect(s.reserve).toBeCloseTo(5, 6);
  });

  it("clamps the fuel fraction to [0,1]", () => {
    const over = computeFuelStrategy(
      inputs({ fuelLevel: 120, tankCapacity: 100, perLap: 2 }),
    );
    expect(over.fuelPct).toBe(1);
  });

  it("derives the reserve from the current level when capacity is unknown", () => {
    const s = computeFuelStrategy(
      inputs({ fuelLevel: 40, tankCapacity: null, reservePct: 0.1, perLap: 2 }),
    );
    expect(s.reserve).toBeCloseTo(4, 6);
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
    reservePct: 0.05,
    lapsRemaining: 10,
    currentLap: 5,
    stintStartLap: 1,
  });

  it("flags a comfortable finish", () => {
    const s = computeFuelStrategy(finishing);
    expect(s.status).toBe("finish");
    expect(s.finishesOnFuel).toBe(true);
    expect(s.fuelToFinish).toBeCloseTo(25, 6);
    expect(s.fuelDelta).toBeCloseTo(20, 6); // usable 45 − 25
    expect(s.marginLaps).toBe(8); // floor(18 − 10)
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
    expect(s.lapsOfFuelSafe).toBeCloseTo(18, 6); // 45 / 2.5
  });
});

describe("computeFuelStrategy — fuel save vs. mandatory pit", () => {
  it("suggests a save when the deficit is small (≤15%)", () => {
    // usable 18 L vs 20 L needed → save ≈ 10%.
    const s = computeFuelStrategy(
      inputs({
        fuelLevel: 23,
        tankCapacity: 100,
        perLap: 2,
        reservePct: 0.05,
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
        reservePct: 0.05,
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
      reservePct: 0.05,
      lapsRemaining: 10,
      currentLap: 8,
      stintStartLap: 3,
    }),
  );

  it("reports stint length from the usable tank", () => {
    expect(s.stintLength).toBe(38); // floor(95 / 2.5)
  });

  it("tracks laps used this stint", () => {
    expect(s.stintUsed).toBe(5); // 8 − 3
  });

  it("derives the must-pit-by countdown and window", () => {
    expect(s.pitInLaps).toBe(18); // floor(45 / 2.5)
    expect(s.recommendedPitLap).toBe(26); // 8 + 18
    expect(s.pitWindow).toEqual([25, 26]);
  });
});

describe("computeFuelStrategy — multi-stop planning", () => {
  it("produces a greedy primary plan plus an even alternative", () => {
    const s = computeFuelStrategy(
      inputs({
        fuelLevel: 20,
        tankCapacity: 40,
        perLap: 2,
        reservePct: 0.05,
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
        reservePct: 0.05,
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
