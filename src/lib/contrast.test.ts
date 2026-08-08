import { describe, expect, it } from "vitest";

import { readableInk, relativeLuminance, tint } from "./contrast";

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
