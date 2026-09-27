import { describe, expect, it } from "vitest";

import {
  composite,
  contrastRatio,
  hueDistance,
  readableInk,
  relativeLuminance,
  tint,
  toOklch,
} from "./contrast";

const DARK = "var(--color-on-accent)";
const WHITE = "oklch(100% 0 0)";

describe("relativeLuminance", () => {
  it("anchors on black and white", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 5);
  });

  it("accepts short hex and a missing hash", () => {
    expect(relativeLuminance("#fff")).toBeCloseTo(1, 5);
    expect(relativeLuminance("ffffff")).toBeCloseTo(1, 5);
  });

  it("returns null for anything it cannot parse", () => {
    expect(relativeLuminance("rebeccapurple")).toBeNull();
    expect(relativeLuminance("")).toBeNull();
    expect(relativeLuminance("#12345")).toBeNull();
  });
});

describe("readableInk", () => {
  it("puts dark ink on light class colours", () => {
    // iRacing's yellow/green/cyan classes are the common light case.
    expect(readableInk("#ffe100")).toBe(DARK);
    expect(readableInk("#00ff88")).toBe(DARK);
  });

  it("puts white ink on dark class colours", () => {
    // …and the dark case is exactly why this isn't hard-coded to `on-accent`:
    // a navy class with dark ink on it would be unreadable.
    expect(readableInk("#0b1d51")).toBe(WHITE);
    expect(readableInk("#7a0010")).toBe(WHITE);
  });

  it("assumes dark — the safe default on this app's paper — when unparseable", () => {
    expect(readableInk("not-a-colour")).toBe(WHITE);
  });
});

describe("tint", () => {
  it("mixes the colour into transparency at the given alpha", () => {
    expect(tint("#ff0000", 0.16)).toBe(
      "color-mix(in oklab, #ff0000 16%, transparent)"
    );
  });

  it("passes CSS variables through untouched, so tokens still theme", () => {
    expect(tint("var(--color-accent)", 0.14)).toBe(
      "color-mix(in oklab, var(--color-accent) 14%, transparent)"
    );
  });
});

describe("contrastRatio", () => {
  it("spans 1 to 21, symmetrically", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("cannot measure what it cannot parse", () => {
    expect(contrastRatio("var(--x)", "#000000")).toBeNull();
  });
});

describe("composite", () => {
  it("paints a translucent colour over a ground the way a browser does", () => {
    expect(composite("rgba(255,255,255,0.5)", "#000000")).toBe("#808080");
    expect(composite("rgba(255, 0, 0, 1)", "#00ff00")).toBe("#ff0000");
  });

  it("leaves an opaque or unparseable colour alone", () => {
    expect(composite("#123456", "#000000")).toBe("#123456");
    expect(composite("rgba(1,2,3,0.5)", "var(--x)")).toBe("rgba(1,2,3,0.5)");
  });
});

describe("toOklch / hueDistance", () => {
  it("reads a grey as chroma zero", () => {
    expect(toOklch("#808080")!.c).toBeLessThan(1e-3);
  });

  it("puts the primaries where OKLCH puts them", () => {
    expect(toOklch("#ff0000")!.h).toBeCloseTo(29.2, 0);
    expect(toOklch("#0000ff")!.h).toBeCloseTo(264.1, 0);
    expect(toOklch("#ffffff")!.l).toBeCloseTo(1, 3);
  });

  it("measures the short way round the wheel", () => {
    expect(hueDistance(350, 10)).toBe(20);
    expect(hueDistance(10, 350)).toBe(20);
    expect(hueDistance(0, 180)).toBe(180);
  });

  it("is null for anything unparseable", () => {
    expect(toOklch("not-a-colour")).toBeNull();
  });
});
