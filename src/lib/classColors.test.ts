import { describe, expect, it } from "vitest";

import {
  CLASS_RAMP,
  classBandFill,
  classColorFor,
  classRowFill,
  classTint,
} from "./classColors";
import { THEMES } from "../themes";

/* -------------------------------------------------------------------------- */
/*  Hue maths — enough to assert the ramp's whole reason for existing          */
/* -------------------------------------------------------------------------- */

/** sRGB hex → OKLCH hue in degrees, plus chroma (to spot near-greys). */
function hueOf(hex: string): { h: number; c: number } {
  const v = parseInt(hex.replace("#", ""), 16);
  const srgb = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((n) => {
    const u = n / 255;
    return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = srgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return {
    h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360,
    c: Math.hypot(A, B),
  };
}

/** Shortest angular distance between two hues, 0–180. */
function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Pull the hue out of an `oklch(L% C H)` token string. */
function themeHue(token: string): number {
  const m = token.match(/oklch\([\d.]+%\s+([\d.]+)\s+([\d.]+)\)/);
  return m ? Number(m[2]) : Number.NaN;
}

/**
 * Every status hue the ramp has to stay clear of, gathered from the live
 * themes rather than hard-coded — so retheming the app cannot silently walk a
 * status colour into a class colour without this failing.
 */
function reservedHues(): { name: string; hue: number }[] {
  const out: { name: string; hue: number }[] = [];
  for (const t of THEMES) {
    for (const key of ["danger", "primary", "warning", "accent"] as const) {
      const hue = themeHue(t.colors[key]);
      // `graphite`'s primary is a near-grey; a hue it barely has cannot collide.
      if (Number.isFinite(hue)) out.push({ name: `${t.id}.${key}`, hue });
    }
  }
  return out;
}

/** How far the least-clear ramp entry sits from any reserved hue. */
const MIN_CLEARANCE = 25;

describe("CLASS_RAMP", () => {
  it("covers the five classes iRacing actually runs", () => {
    expect(CLASS_RAMP).toHaveLength(5);
  });

  it("holds no red — the colour this app spends on lapped traffic", () => {
    // The brief, stated as a test. iRacing's own GT3 colour is #ff4d4d, which
    // is exactly what must never come back.
    for (const color of CLASS_RAMP) {
      const { h } = hueOf(color);
      expect(hueGap(h, 25)).toBeGreaterThan(MIN_CLEARANCE);
    }
  });

  it("clears every theme's status hues", () => {
    const reserved = reservedHues();
    expect(reserved.length).toBeGreaterThan(8);
    for (const color of CLASS_RAMP) {
      const { h, c } = hueOf(color);
      for (const r of reserved) {
        // A near-grey status colour (graphite's primary) has no hue to collide
        // with; skip it rather than assert against a meaningless angle.
        if (c < 0.02) continue;
        expect({ color, against: r.name, gap: hueGap(h, r.hue) }).toMatchObject({
          gap: expect.any(Number),
        });
        if (hueGap(h, r.hue) <= MIN_CLEARANCE) {
          // The single documented exception: violet against sector purple.
          expect(r.name).toMatch(/sectorPurple/);
        }
      }
    }
  });

  it("puts a big hue step between classes that sit next to each other", () => {
    // Consecutive entries colour consecutive class groups down the screen, so
    // neighbours are the pairs most at risk of blurring together.
    for (let i = 0; i < CLASS_RAMP.length - 1; i++) {
      const a = hueOf(CLASS_RAMP[i]).h;
      const b = hueOf(CLASS_RAMP[i + 1]).h;
      expect(hueGap(a, b)).toBeGreaterThan(100);
    }
  });

  it("keeps all five mutually distinct", () => {
    for (let i = 0; i < CLASS_RAMP.length; i++) {
      for (let j = i + 1; j < CLASS_RAMP.length; j++) {
        expect(hueGap(hueOf(CLASS_RAMP[i]).h, hueOf(CLASS_RAMP[j]).h)).toBeGreaterThan(30);
      }
    }
  });
});

describe("classColorFor", () => {
  it("gives each of the first five classes its own ramp entry", () => {
    const seen = [0, 1, 2, 3, 4].map(classColorFor);
    expect(new Set(seen).size).toBe(5);
    expect(seen).toEqual([...CLASS_RAMP]);
  });

  it("is stable — the same index is always the same colour", () => {
    expect(classColorFor(2)).toBe(classColorFor(2));
  });

  it("does not hand a sixth class the first class's colour", () => {
    // Six classes is not a thing iRacing does; this only has to be total and
    // non-repeating, not beautiful.
    expect(classColorFor(5)).not.toBe(classColorFor(0));
    expect(classColorFor(5)).toContain("color-mix");
  });

  it("is total for any index a field could produce", () => {
    for (const i of [0, 4, 5, 9, 12, 40]) {
      expect(classColorFor(i)).toBeTruthy();
    }
  });
});

describe("classTint", () => {
  it("washes the whole row, kept to a whisper behind the values", () => {
    const t = classTint(CLASS_RAMP[0]);
    expect(t).toContain(CLASS_RAMP[0]);
    expect(t).toMatch(/color-mix\(in oklab, .+ 14%, transparent\)/);
  });

  it("works on the darkened colours a sixth class would get", () => {
    expect(classTint(classColorFor(5))).toContain("color-mix");
  });
});

describe("classRowFill", () => {
  const STOP = "calc(3px + 0.25rem + 2.1rem)";

  it("runs in from the left edge and stops at the extent it is given", () => {
    const f = classRowFill(CLASS_RAMP[0], STOP);
    expect(f).toMatch(/^linear-gradient\(to right,/);
    expect(f).toContain(CLASS_RAMP[0]);
    expect(f).toContain(STOP);
  });

  it("stops hard — the same extent twice, no fade", () => {
    // The edge is the point: it gives the colour a shape. A gradient petering
    // out would read as a smudge behind the values.
    const f = classRowFill(CLASS_RAMP[0], STOP);
    expect(f.split(STOP)).toHaveLength(3); // once to end the colour, once to start transparent
    expect(f).toContain(`transparent ${STOP}`);
  });

  it("leaves the rest of the row as bare paper", () => {
    // Fully transparent past the stop, not a darker tint — the row's own zebra
    // ground is what shows through there.
    expect(classRowFill(CLASS_RAMP[2], STOP)).toMatch(/transparent .+\)$/);
  });

  it("stays a tint, where the band it answers to is solid", () => {
    // The row's stripe and the group's band are the same colour said at two
    // volumes: the band is the class colour outright, the stripe a whisper of
    // it behind the leading number. If the stripe ever went solid too there
    // would be no hierarchy left between a heading and the rows under it.
    const f = classRowFill(CLASS_RAMP[0], STOP);
    expect(f).toContain("color-mix");
    expect(f).toContain("transparent");
    expect(classBandFill(CLASS_RAMP[0])).not.toContain("color-mix");
  });

  it("takes a length, not a share of the row", () => {
    // A percentage stop would drift across the columns every time one was
    // switched on or off; a length lands on the column boundary at any table
    // scale. Checked with the colour's own alpha stripped out, since that is a
    // percentage too and not a stop position.
    const stops = classRowFill(CLASS_RAMP[0], STOP).replace(/color-mix\([^)]*\)/g, "C");
    expect(stops).not.toMatch(/\d+%/);
    expect(stops).toContain(STOP);
  });

  it("works on the darkened colours a sixth class would get", () => {
    expect(classRowFill(classColorFor(5), STOP)).toContain("linear-gradient");
  });
});

describe("classBandFill", () => {
  it("covers the whole band, not a stripe of it", () => {
    // A band is the heading; its rows are what it heads. A clipped fill made it
    // read as one of them.
    const f = classBandFill(CLASS_RAMP[0]);
    expect(f).not.toContain("linear-gradient");
    expect(f).toContain(CLASS_RAMP[0]);
  });

  it("is the class colour outright — the rows it opens only tint it", () => {
    // Masthead solid, rows striped. A block is the shape the eye finds in
    // peripheral vision without being sent looking for a hue.
    expect(classBandFill(CLASS_RAMP[0])).toBe(CLASS_RAMP[0]);
    expect(classRowFill(CLASS_RAMP[0], "1rem")).toContain("color-mix");
    expect(classTint(CLASS_RAMP[0])).toContain("14%");
  });

  it("works on the darkened colours a sixth class would get", () => {
    expect(classBandFill(classColorFor(5))).toContain("color-mix");
  });
});
