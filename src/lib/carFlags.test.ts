import { describe, expect, it } from "vitest";

import { carFlagMarks } from "./carFlags";

const flagsOf = (flags: string[] | undefined) =>
  carFlagMarks(flags).map((m) => m.flag);

describe("carFlagMarks", () => {
  it("is empty with no flags, or from a bridge that sends none", () => {
    expect(carFlagMarks([])).toEqual([]);
    expect(carFlagMarks(undefined)).toEqual([]);
  });

  it("orders the marks most severe first, whatever order they arrive in", () => {
    expect(flagsOf(["furled", "repair", "black"])).toEqual([
      "black",
      "repair",
      "furled",
    ]);
  });

  it("shows a damaged car that also cut the track with both marks", () => {
    expect(flagsOf(["repair", "furled"])).toEqual(["repair", "furled"]);
  });

  it("shows a disqualification alone", () => {
    expect(flagsOf(["disqualify", "black", "repair", "furled"])).toEqual([
      "disqualify",
    ]);
  });

  it("ignores flags it has no mark for", () => {
    expect(flagsOf(["servicible", "black", "green"])).toEqual(["black"]);
  });

  it("draws the slow-down as a warning and everything else as danger", () => {
    const marks = carFlagMarks(["black", "repair", "furled"]);
    expect(marks.map((m) => m.color)).toEqual([
      "var(--color-danger)",
      "var(--color-danger)",
      "var(--color-warning)",
    ]);
    expect(carFlagMarks(["disqualify"])[0].color).toBe("var(--color-danger)");
  });
});
