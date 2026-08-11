import { describe, expect, it } from "vitest";

import {
  MOCK_FIELD_SIZE,
  MOCK_PLAYER_IDX,
  MOCK_START_OFFSET_S,
  mockPlayerTelemetry,
  mockSession,
  mockStandings,
} from "./mockData";

describe("mockPlayerTelemetry", () => {
  it("produces a plausible player frame", () => {
    const f = mockPlayerTelemetry(12);
    expect(f.gear).toBeGreaterThanOrEqual(1);
    expect(f.gear).toBeLessThanOrEqual(6);
    expect(f.throttle!).toBeGreaterThanOrEqual(0);
    expect(f.throttle!).toBeLessThanOrEqual(1);
    expect(f.speedKmh!).toBeGreaterThan(0);
    expect(f.fuelLevelPct!).toBeGreaterThan(0);
    expect(f.lapDistPct!).toBeGreaterThanOrEqual(0);
    expect(f.lapDistPct!).toBeLessThan(1);
    // All four corners present.
    expect(Object.keys(f.tyres)).toEqual(["lf", "rf", "lr", "rr"]);
  });

  it("is deterministic for a given time", () => {
    expect(mockPlayerTelemetry(7)).toEqual(mockPlayerTelemetry(7));
  });
});

describe("mockSession", () => {
  it("builds a full roster and two classes", () => {
    const s = mockSession(30);
    expect(s.drivers).toHaveLength(MOCK_FIELD_SIZE);
    expect(s.driverCarIdx).toBe(MOCK_PLAYER_IDX);
    expect(s.classes).toHaveLength(2);
    expect(s.sectorStarts).toHaveLength(3);
  });

  it("reports warmup then racing state", () => {
    expect(mockSession(5).sessionStateLabel).toBe("Warmup");
    expect(mockSession(60).sessionStateLabel).toBe("Racing");
  });
});

describe("mockStandings", () => {
  it("returns one entry per car with a single player and a leader", () => {
    const p = mockStandings(20);
    expect(p.entries).toHaveLength(MOCK_FIELD_SIZE);
    expect(p.playerCarIdx).toBe(MOCK_PLAYER_IDX);
    expect(p.entries.filter((e) => e.isPlayer)).toHaveLength(1);
    expect(p.entries.filter((e) => e.isOverallLeader)).toHaveLength(1);
    expect(p.classes).toHaveLength(2);
    expect(p.sectorCount).toBe(3);
  });

  it("assigns every overall position exactly once", () => {
    const positions = mockStandings(45)
      .entries.map((e) => e.position)
      .sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(positions).toEqual(
      Array.from({ length: MOCK_FIELD_SIZE }, (_, i) => i + 1)
    );
  });
});

/*
 * The feed exists to explain the UI to someone who has never seen it, so these
 * cover the things that were previously dead in every demo and every
 * screenshot: a position that renders, a lap you can see the shape of, tyres
 * that land on more than one colour, and a field that has actually spread out.
 */
describe("mockPlayerTelemetry — the drive", () => {
  /** One lap of frames, sampled finely enough to catch a braking zone. */
  const lap = Array.from({ length: 400 }, (_, i) =>
    mockPlayerTelemetry(MOCK_START_OFFSET_S + (i * 138) / 400)
  );

  it("carries the player's own position", () => {
    const f = mockPlayerTelemetry(MOCK_START_OFFSET_S);
    expect(f.playerCarPosition).toBeGreaterThanOrEqual(1);
    expect(f.playerCarPosition).toBeLessThanOrEqual(MOCK_FIELD_SIZE);
    expect(f.playerCarClassPosition).toBeGreaterThanOrEqual(1);
  });

  it("agrees with the standings on where the player is", () => {
    const t = MOCK_START_OFFSET_S + 200;
    const fromStandings = mockStandings(t).entries.find((e) => e.isPlayer);
    expect(mockPlayerTelemetry(t).playerCarPosition).toBe(fromStandings!.position);
  });

  it("opens mid-race rather than on lap zero", () => {
    const f = mockPlayerTelemetry(MOCK_START_OFFSET_S);
    expect(f.lap).toBeGreaterThanOrEqual(10);
    expect(f.fuelLevelPct!).toBeLessThan(0.7); // part-way through a stint
  });

  it("brakes for corners and runs flat out between them", () => {
    expect(lap.some((f) => f.brake! > 0.5)).toBe(true);
    expect(lap.some((f) => f.throttle === 1 && f.brake === 0)).toBe(true);
    // Never both pedals at once.
    expect(lap.every((f) => !(f.throttle! > 0.05 && f.brake! > 0.05))).toBe(true);
  });

  it("uses the whole speed range and the whole gearbox", () => {
    const speeds = lap.map((f) => f.speedKmh!);
    expect(Math.min(...speeds)).toBeLessThan(100);
    expect(Math.max(...speeds)).toBeGreaterThan(250);
    const gears = new Set(lap.map((f) => f.gear));
    expect(gears.size).toBeGreaterThanOrEqual(5);
  });

  it("keeps gear and revs consistent with speed", () => {
    for (const f of lap) {
      expect(f.rpm!).toBeGreaterThan(3000);
      expect(f.rpm!).toBeLessThanOrEqual(7700);
    }
    // Faster frames are never in a lower gear than slower ones.
    const sorted = [...lap].sort((a, b) => a.speedKmh! - b.speedKmh!);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].gear!).toBeGreaterThanOrEqual(sorted[i - 1].gear!);
    }
  });

  it("burns fuel down a stint so a per-lap figure can be sampled", () => {
    const a = mockPlayerTelemetry(MOCK_START_OFFSET_S);
    const b = mockPlayerTelemetry(MOCK_START_OFFSET_S + 138);
    const burned = a.fuelLevel! - b.fuelLevel!;
    expect(burned).toBeGreaterThan(2);
    expect(burned).toBeLessThan(3.5);
  });

  it("spreads the four tyres across the heat scale", () => {
    const f = mockPlayerTelemetry(MOCK_START_OFFSET_S);
    const temps = [f.tyres.lf, f.tyres.rf, f.tyres.lr, f.tyres.rr].map(
      (c) => c!.tempM!
    );
    expect(Math.max(...temps) - Math.min(...temps)).toBeGreaterThan(6);
  });
});

describe("mockStandings — a field that has raced", () => {
  const p = mockStandings(MOCK_START_OFFSET_S);

  it("has lapped the tail of the field", () => {
    expect(p.entries.some((e) => e.gapIsLaps && e.lapsDown >= 1)).toBe(true);
  });

  it("ages tyres by the stint, not by the race", () => {
    expect(p.entries.every((e) => e.tireLaps! < 20)).toBe(true);
  });

  it("moves someone on the position-change column", () => {
    // Deterministic in t, so sample a lap's worth and require some movement.
    const moved = Array.from({ length: 60 }, (_, i) =>
      mockStandings(MOCK_START_OFFSET_S + i * 10).entries.some(
        (e) => e.positionsGainedLastLap !== 0
      )
    );
    expect(moved.some(Boolean)).toBe(true);
  });
});

describe("mockData — invariants the app depends on", () => {
  it("never runs the lap counter backwards", () => {
    // Both fuel samplers treat a falling lap as a session reset and discard
    // their history, so the position swing must never be able to cause one.
    let prev = -1;
    for (let t = MOCK_START_OFFSET_S; t < MOCK_START_OFFSET_S + 600; t += 0.5) {
      const lap = mockPlayerTelemetry(t).lap!;
      expect(lap).toBeGreaterThanOrEqual(prev);
      prev = lap;
    }
  });

  it("keeps fuel monotonic within a stint", () => {
    let prev = Infinity;
    for (let t = MOCK_START_OFFSET_S; t < MOCK_START_OFFSET_S + 400; t += 1) {
      const f = mockPlayerTelemetry(t).fuelLevel!;
      expect(f).toBeLessThanOrEqual(prev + 1e-6);
      prev = f;
    }
  });
});

describe("mockStandings — gaps are measured from the right car", () => {
  const p = mockStandings(MOCK_START_OFFSET_S);

  it("gives each class leader a zero gap to its own class leader", () => {
    for (const e of p.entries.filter((x) => x.isClassLeader)) {
      expect(e.gapToClassLeader).toBeLessThan(0.5);
    }
  });

  it("keeps the class gap no larger than the overall gap", () => {
    for (const e of p.entries) {
      expect(e.gapToClassLeader!).toBeLessThanOrEqual(e.gapToLeader! + 1e-6);
    }
  });
});
