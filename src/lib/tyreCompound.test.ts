import { describe, expect, it } from "vitest";

import type { TireCompoundInfo } from "../telemetry/types";
import { tyreCompound, tyreName } from "./tyreCompound";

const GT3: TireCompoundInfo[] = [
  { index: 0, type: "Hard" },
  { index: 1, type: "Wet" },
];

describe("tyreCompound", () => {
  it("is null when the car reports no compound", () => {
    expect(tyreCompound(null, GT3)).toBeNull();
  });

  it("classifies a listed compound by its name", () => {
    expect(tyreCompound(0, GT3)).toBe("hard");
    expect(tyreCompound(1, GT3)).toBe("wet");
  });

  it("tells every dry compound apart on a car that lists several", () => {
    const list = [
      { index: 0, type: "Soft" },
      { index: 1, type: "Medium" },
      { index: 2, type: "Hard" },
      { index: 3, type: "Wet" },
    ];
    expect(list.map((c) => tyreCompound(c.index, list))).toEqual([
      "soft",
      "medium",
      "hard",
      "wet",
    ]);
  });

  it("reads intermediates as inters and rain tyres as wets", () => {
    const list = [
      { index: 2, type: "Intermediate" },
      { index: 3, type: "Rain" },
    ];
    expect(tyreCompound(2, list)).toBe("inter");
    expect(tyreCompound(3, list)).toBe("wet");
  });

  it("ignores case and catches variants of a name", () => {
    const list = [
      { index: 0, type: "SOFT" },
      { index: 1, type: "Supersoft" },
      { index: 2, type: "medium" },
    ];
    expect(tyreCompound(0, list)).toBe("soft");
    expect(tyreCompound(1, list)).toBe("soft");
    expect(tyreCompound(2, list)).toBe("medium");
  });

  it("calls a compound it cannot name a dry", () => {
    const list = [
      { index: 0, type: "Primary" },
      { index: 1, type: "Dry" },
    ];
    expect(tyreCompound(0, list)).toBe("dry");
    expect(tyreCompound(1, list)).toBe("dry");
  });

  it("calls every compound a dry when the car has no wet tyre listed", () => {
    expect(tyreCompound(0, [])).toBe("dry");
    expect(tyreCompound(1, undefined)).toBe("dry");
  });

  it("is null for an index outside a non-empty list", () => {
    expect(tyreCompound(4, GT3)).toBeNull();
  });
});

describe("tyreName", () => {
  it("names a listed compound", () => {
    expect(tyreName(1, GT3)).toBe("Wet");
  });

  it("is null for an unlisted or missing compound", () => {
    expect(tyreName(4, GT3)).toBeNull();
    expect(tyreName(null, GT3)).toBeNull();
    expect(tyreName(0, [{ index: 0, type: "" }])).toBeNull();
  });
});
