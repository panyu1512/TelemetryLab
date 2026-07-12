import { describe, expect, it } from "vitest";

import {
  deltaColor,
  HEAT_MAX,
  HEAT_MIN,
  heatColor,
  signedDelta,
} from "./scales";

describe("heatColor", () => {
  it("returns a border token for missing values", () => {
    expect(heatColor(null)).toBe("var(--color-border-strong)");
    expect(heatColor(NaN)).toBe("var(--color-border-strong)");
  });

  it("clamps below the range to the cold stop (blue)", () => {
    expect(heatColor(HEAT_MIN - 20)).toBe("rgb(77 156 248)");
    expect(heatColor(HEAT_MIN)).toBe("rgb(77 156 248)");
  });

  it("clamps above the range to the hot stop (red)", () => {
    expect(heatColor(HEAT_MAX + 20)).toBe("rgb(244 86 79)");
    expect(heatColor(HEAT_MAX)).toBe("rgb(244 86 79)");
  });

  it("hits the optimal stop exactly (accent green)", () => {
    expect(heatColor(78)).toBe("rgb(47 214 127)");
  });

  it("interpolates between stops", () => {
    // Midway between 78 (47,214,127) and 90 (240,154,60) → componentwise mean.
    const c = heatColor(84);
    expect(c).toBe("rgb(144 184 94)");
  });

  it("produces a valid rgb string across the whole band", () => {
    for (let t = HEAT_MIN; t <= HEAT_MAX; t += 1) {
      expect(heatColor(t)).toMatch(/^rgb\(\d{1,3} \d{1,3} \d{1,3}\)$/);
    }
  });
});

describe("signedDelta", () => {
  it("formats faster (negative) with a minus glyph", () => {
    expect(signedDelta(-0.25)).toBe("−0.250");
  });

  it("formats slower (positive) with a plus", () => {
    expect(signedDelta(0.25)).toBe("+0.250");
  });

  it("treats zero as non-negative (plus)", () => {
    expect(signedDelta(0)).toBe("+0.000");
  });

  it("dashes missing values", () => {
    expect(signedDelta(null)).toBe("—");
    expect(signedDelta(NaN)).toBe("—");
  });
});

describe("deltaColor", () => {
  it("uses accent for meaningfully faster", () => {
    expect(deltaColor(-0.5)).toBe("var(--color-accent)");
  });

  it("uses danger for meaningfully slower", () => {
    expect(deltaColor(0.5)).toBe("var(--color-danger)");
  });

  it("uses muted inside the dead-band and for missing values", () => {
    expect(deltaColor(0)).toBe("var(--color-muted)");
    expect(deltaColor(0.0005)).toBe("var(--color-muted)");
    expect(deltaColor(null)).toBe("var(--color-muted)");
  });
});
