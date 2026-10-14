import { describe, expect, it } from "vitest";

import { FULL_HEIGHT_ASPECT, markHeight, viewBoxAspect } from "./markSize";

describe("markHeight", () => {
  it("keeps the full height for square and tall marks", () => {
    expect(markHeight(21, 1)).toBe(21);
    expect(markHeight(21, 0.73)).toBe(21); // Ferrari
    expect(markHeight(21, FULL_HEIGHT_ASPECT)).toBe(21);
  });

  it("draws every wider mark at one area", () => {
    const area = (aspect: number) => {
      const h = markHeight(21, aspect);
      return h * h * aspect;
    };
    const target = 21 * 21 * FULL_HEIGHT_ASPECT;
    for (const aspect of [1.5, 2.5, 2.69, 3.87, 5.51]) {
      expect(area(aspect)).toBeCloseTo(target, 6);
    }
  });

  it("never draws a mark taller than the row allows", () => {
    for (const aspect of [0.2, 1, 1.3, 2, 10]) {
      expect(markHeight(24, aspect)).toBeLessThanOrEqual(24);
    }
  });

  it("gets shorter as a mark gets wider", () => {
    expect(markHeight(21, 2)).toBeGreaterThan(markHeight(21, 3));
    expect(markHeight(21, 3)).toBeGreaterThan(markHeight(21, 5));
  });

  it("treats an unreadable aspect as square", () => {
    expect(markHeight(21, Number.NaN)).toBe(21);
    expect(markHeight(21, Number.POSITIVE_INFINITY)).toBe(21);
  });

  it("brings the widest marks to within a third of the narrowest badges' area", () => {
    // The point of the module: McLaren (5.51:1) and a square badge used to
    // differ ~3×; now the wide mark is no larger than 1.3× the square one.
    const wide = markHeight(21, 5.51) ** 2 * 5.51;
    const square = markHeight(21, 1) ** 2;
    expect(wide / square).toBeLessThanOrEqual(FULL_HEIGHT_ASPECT + 1e-9);
  });
});

describe("viewBoxAspect", () => {
  it("reads width ÷ height from a viewBox", () => {
    expect(viewBoxAspect("0 0 24 24")).toBe(1);
    expect(viewBoxAspect("-0.48 9.735 24.959 4.529")).toBeCloseTo(5.511, 3);
    expect(viewBoxAspect("0,0,30,10")).toBe(3);
  });

  it("falls back to square for anything it cannot read", () => {
    expect(viewBoxAspect(undefined)).toBe(1);
    expect(viewBoxAspect("")).toBe(1);
    expect(viewBoxAspect("0 0 24")).toBe(1);
    expect(viewBoxAspect("0 0 0 10")).toBe(1);
    expect(viewBoxAspect("a b c d")).toBe(1);
  });
});
