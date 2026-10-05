import { describe, expect, it } from "vitest";

import type { TireCompoundInfo } from "../telemetry/types";
import { tyreKind, tyreName } from "./tyreCompound";

const GT3: TireCompoundInfo[] = [
  { index: 0, type: "Hard" },
  { index: 1, type: "Wet" },
];

describe("tyreKind", () => {
  it("is null when the car reports no compound", () => {
    expect(tyreKind(null, GT3)).toBeNull();
  });

  it("classifies a listed compound by its name", () => {
    expect(tyreKind(0, GT3)).toBe("slick");
    expect(tyreKind(1, GT3)).toBe("wet");
  });

  it("treats intermediates and rain tyres as treaded", () => {
    const list = [
      { index: 2, type: "Intermediate" },
      { index: 3, type: "Rain" },
    ];
    expect(tyreKind(2, list)).toBe("wet");
    expect(tyreKind(3, list)).toBe("wet");
  });

  it("calls every compound a slick when the car has no wet tyre listed", () => {
    expect(tyreKind(0, [])).toBe("slick");
    expect(tyreKind(1, undefined)).toBe("slick");
  });

  it("is null for an index outside a non-empty list", () => {
    expect(tyreKind(4, GT3)).toBeNull();
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
