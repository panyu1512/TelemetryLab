import { describe, expect, it } from "vitest";

import {
  MOCK_FIELD_SIZE,
  MOCK_PLAYER_IDX,
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
