import { describe, expect, it } from "vitest";

import { compoundLook } from "./tyreCompound";

const TABLE = [
  { index: 0, type: "Hard" },
  { index: 1, type: "Soft" },
  { index: 2, type: "Medium" },
  { index: 3, type: "Wet" },
];

describe("compoundLook", () => {
  it("is nothing when the car reports no compound", () => {
    expect(compoundLook(null, TABLE)).toBeNull();
    expect(compoundLook(undefined, TABLE)).toBeNull();
    expect(compoundLook(-1, TABLE)).toBeNull();
  });

  it("names the index from the session's tyre table", () => {
    expect(compoundLook(0, TABLE)).toEqual({ kind: "hard", letter: "H", label: "Hard" });
    expect(compoundLook(1, TABLE)).toEqual({ kind: "soft", letter: "S", label: "Soft" });
    expect(compoundLook(2, TABLE)).toEqual({ kind: "medium", letter: "M", label: "Medium" });
  });

  it("draws a wet as a drop, not a letter", () => {
    expect(compoundLook(3, TABLE)).toEqual({ kind: "wet", letter: "", label: "Wet" });
    expect(compoundLook(0, [{ index: 0, type: "Rain" }])?.kind).toBe("wet");
  });

  it("reads the sim's other spellings", () => {
    expect(compoundLook(0, [{ index: 0, type: "Intermediate" }])).toMatchObject({
      kind: "inter",
      letter: "I",
    });
    expect(compoundLook(0, [{ index: 0, type: "Qualifying" }])).toMatchObject({
      kind: "other",
      letter: "Q",
      label: "Qualifying",
    });
    expect(compoundLook(0, [{ index: 0, type: "All-Purpose" }])).toMatchObject({
      kind: "other",
      letter: "A",
    });
  });

  it("falls back to the bare index letters without a table — never guessing a compound", () => {
    expect(compoundLook(0, undefined)).toEqual({ kind: "other", letter: "P", label: "Compound P" });
    expect(compoundLook(1, [])).toMatchObject({ kind: "other", letter: "A" });
    expect(compoundLook(7, TABLE)).toMatchObject({ kind: "other", letter: "7" });
  });

  it("ignores a blank entry for the index", () => {
    expect(compoundLook(0, [{ index: 0, type: "  " }])).toMatchObject({ letter: "P" });
  });
});
