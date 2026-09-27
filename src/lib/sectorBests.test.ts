import { describe, expect, it } from "vitest";

import { classBestSectors, gradeSector, sameClassBests } from "./sectorBests";
import { entry } from "./standingsEntry.fixture";
import type { SectorSplit } from "../telemetry/types";

function sector(index: number, lastTime: number | null, bestTime: number | null, status: SectorSplit["status"] = "slower"): SectorSplit {
  return {
    index,
    lastTime,
    bestTime,
    delta: lastTime != null && bestTime != null ? lastTime - bestTime : null,
    status,
  };
}

describe("classBestSectors", () => {
  it("takes the quickest personal best per sector, per class", () => {
    const bests = classBestSectors(
      [
        entry(0, { carClassId: 1, sectors: [sector(0, 30.4, 30.1), sector(1, 40.2, 40.0)] }),
        entry(1, { carClassId: 1, sectors: [sector(0, 30.3, 30.2), sector(1, 39.9, 39.8)] }),
        entry(2, { carClassId: 2, sectors: [sector(0, 33.0, 32.9), sector(1, null, null)] }),
      ],
      2,
    );
    expect(bests[1]).toEqual([30.1, 39.8]);
    expect(bests[2]).toEqual([32.9, null]);
  });

  it("ignores a missing or non-positive best", () => {
    const bests = classBestSectors([entry(0, { sectors: [sector(0, 30, 0)] })], 1);
    expect(bests[1]).toEqual([null]);
  });
});

describe("sameClassBests", () => {
  it("compares values, not identity", () => {
    expect(sameClassBests({ 1: [30, null] }, { 1: [30, null] })).toBe(true);
    expect(sameClassBests({ 1: [30, null] }, { 1: [30, 40] })).toBe(false);
    expect(sameClassBests({ 1: [30] }, { 2: [30] })).toBe(false);
    expect(sameClassBests({ 1: [30] }, { 1: [30], 2: [31] })).toBe(false);
  });
});

describe("gradeSector", () => {
  it("paints the class best purple — graded against the class, not the field", () => {
    // A GT4's sector is never the field's best; it can still be its class's.
    expect(gradeSector(sector(0, 32.9, 32.9, "personal_best"), 32.9)).toBe("class_best");
  });

  it("keeps a personal best that is not the class best green", () => {
    expect(gradeSector(sector(0, 33.1, 33.1, "personal_best"), 32.9)).toBe("personal_best");
  });

  it("passes the losses through", () => {
    expect(gradeSector(sector(0, 34, 33, "much_slower"), 32.9)).toBe("much_slower");
    expect(gradeSector(sector(0, 33.2, 33, "slower"), 32.9)).toBe("slower");
  });

  it("has nothing to grade without a time", () => {
    expect(gradeSector(undefined, 30)).toBe("none");
    expect(gradeSector(sector(0, null, 30), 30)).toBe("none");
  });
});
