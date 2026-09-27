import { describe, expect, it } from "vitest";

import { CLASS_RAMP } from "./classColors";
import { composite, contrastRatio } from "./contrast";
import { TOWER, towerInk } from "./towerPalette";

/*
 * The tower's palette is fixed, so its accessibility can be measured once and
 * pinned: every ink against every ground it can land on, at WCAG AA — 4.5:1
 * for text, 3:1 for the graphics (tyre rings) that sit beside a letter.
 */

const ROWS = { rowA: TOWER.rowA, rowB: TOWER.rowB, you: TOWER.meBg } as const;

function ratio(fg: string, bg: string): number {
  const r = contrastRatio(composite(fg, bg), bg);
  if (r == null) throw new Error(`unmeasurable: ${fg} on ${bg}`);
  return r;
}

/** Ink on a tint that is itself composited over `row`. */
function onTint(ink: string, tintColor: string, row: string): number {
  const ground = composite(tintColor, row);
  const r = contrastRatio(ink, ground);
  if (r == null) throw new Error(`unmeasurable: ${ink} on ${tintColor}`);
  return r;
}

function rgba(hex: string, a: number): string {
  const v = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}

describe("tower palette — text on the rows", () => {
  const inks = {
    text: TOWER.text,
    text2: TOWER.text2,
    text3: TOWER.text3,
    dim: TOWER.dim,
    up: TOWER.up,
    down: TOWER.down,
    slower: TOWER.slower,
  };
  for (const [rowName, row] of Object.entries(ROWS)) {
    for (const [inkName, ink] of Object.entries(inks)) {
      it(`${inkName} on ${rowName} clears AA`, () => {
        expect(ratio(ink, row)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("keeps greyed-out ink readable — greyed is quieter, not illegible", () => {
    for (const row of Object.values(ROWS)) {
      expect(ratio(TOWER.dim, row)).toBeGreaterThanOrEqual(4.5);
    }
    // …and still visibly quieter than the ink it replaces.
    expect(ratio(TOWER.dim, TOWER.rowA)).toBeLessThan(ratio(TOWER.text2, TOWER.rowA));
  });
});

describe("tower palette — fills and chips", () => {
  it("prints the class-best fill in AA ink", () => {
    expect(ratio(TOWER.onClassBest, TOWER.classBest)).toBeGreaterThanOrEqual(4.5);
  });

  it("prints a personal best on its tint in AA ink, on every row", () => {
    for (const row of Object.values(ROWS)) {
      expect(onTint(TOWER.personalBest, TOWER.personalBestTint, row)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("prints every state chip in AA ink, on every row", () => {
    const chips: [string, string][] = [
      [TOWER.caution, TOWER.cautionTint],
      [TOWER.disconnected, TOWER.disconnectedTint],
      [TOWER.finalLap, TOWER.finalLapTint],
    ];
    for (const [ink, tint] of chips) {
      for (const row of Object.values(ROWS)) {
        expect(onTint(ink, tint, row)).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(ratio(TOWER.onPit, TOWER.pit)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(TOWER.onDsq, TOWER.dsq)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps a battle's number readable on every class colour's tint", () => {
    for (const accent of CLASS_RAMP) {
      for (const row of Object.values(ROWS)) {
        expect(onTint(TOWER.text, rgba(accent, 0.24), row)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("draws every tyre ring at 3:1 against the rows it sits on", () => {
    for (const ring of [TOWER.soft, TOWER.medium, TOWER.hard, TOWER.inter, TOWER.wet, TOWER.otherTyre]) {
      for (const row of Object.values(ROWS)) {
        expect(ratio(ring, row)).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("tower palette — headers, labels and the legend", () => {
  it("keeps the class header's labels and values readable", () => {
    expect(ratio(TOWER.text3, TOWER.surface)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(TOWER.text2, TOWER.surface)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(TOWER.text, TOWER.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the column labels readable on their own row", () => {
    expect(ratio(TOWER.text3, TOWER.labelRow)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the legend readable on the paper", () => {
    expect(ratio(TOWER.text2, TOWER.paper)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(TOWER.text3, TOWER.paper)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("tower palette — race control", () => {
  it("keeps the yellow bar's labels and values readable", () => {
    expect(ratio(TOWER.yellowLabel, TOWER.yellowBar)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(TOWER.yellowValue, TOWER.yellowBar)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the safety-car bar readable on both of its stripes", () => {
    for (const stripe of [TOWER.scStripeA, TOWER.scStripeB]) {
      expect(ratio(TOWER.scLabel, stripe)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(TOWER.scValue, stripe)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("prints every badge in AA ink", () => {
    const badges: [string, string][] = [
      [TOWER.onRaceBadge, TOWER.raceBadge],
      [TOWER.onYellowBadge, TOWER.flagBadge],
      [TOWER.onScBadge, TOWER.flagBadge],
      [TOWER.caution, TOWER.flagBadge],
      [TOWER.darkInk, TOWER.finalLap],
      [TOWER.darkInk, TOWER.soft],
      [TOWER.darkInk, TOWER.up],
      [TOWER.onPit, TOWER.pit],
      [TOWER.onDsq, TOWER.dsq],
    ];
    for (const [ink, bg] of badges) expect(ratio(ink, bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("towerInk", () => {
  it("picks dark ink on a light class colour and white on a dark one", () => {
    expect(towerInk("#cbda49")).toBe(TOWER.darkInk); // lime
    expect(towerInk("#1e3a8a")).toBe(TOWER.lightInk); // navy
  });

  it("clears AA on every colour of the ramp", () => {
    for (const c of CLASS_RAMP) {
      expect(ratio(towerInk(c), c)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("falls back to white for a colour it cannot measure", () => {
    expect(towerInk("color-mix(in oklab, #00d0f2 70%, black)")).toBe(TOWER.lightInk);
  });
});
