import { describe, expect, it } from "vitest";

import {
  CLASS_NAME_OUTLINE,
  CLASS_FILL_STOPS,
  classFill,
  classFillStrength,
} from "./classFill";
import { CLASS_RAMP } from "./classColors";
import { relativeLuminance } from "./contrast";

type Rgb = [number, number, number];

/**
 * The two grounds a row can have, in sRGB, as the browser composites them over
 * Carbon's `--color-timing-bg` (≈ #030406): the neutral strip
 * (`--color-timing-row`, 7 % white) and the player's (`bg-primary/25`).
 */
const NEUTRAL_ROW: Rgb = [21, 22, 23];
const PLAYER_ROW: Rgb = [22, 42, 67];

function hex(color: string): Rgb {
  const v = parseInt(color.replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** `top` at `alpha` over `under`, blended in gamma space as the browser does. */
function over(top: Rgb, alpha: number, under: Rgb): Rgb {
  return top.map((c, i) => Math.round(alpha * c + (1 - alpha) * under[i])) as Rgb;
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function whiteContrastOn(ground: Rgb): number {
  const lum = relativeLuminance(toHex(ground))!;
  return 1.05 / (lum + 0.05);
}

describe("classFillStrength", () => {
  it("is the stops' strengths at the stops", () => {
    for (const s of CLASS_FILL_STOPS) {
      expect(classFillStrength(s.at)).toBeCloseTo(s.alpha, 6);
    }
  });

  it("interpolates linearly between stops, as the gradient is drawn", () => {
    const [a, b] = CLASS_FILL_STOPS;
    const mid = (a.at + b.at) / 2;
    expect(classFillStrength(mid)).toBeCloseTo((a.alpha + b.alpha) / 2, 6);
  });

  it("only ever thins out from the edge to the end of its reach", () => {
    let prev = Infinity;
    for (let t = 0; t <= 1; t += 0.05) {
      const s = classFillStrength(t);
      expect(s).toBeLessThanOrEqual(prev);
      prev = s;
    }
  });

  it("clamps outside its reach — strongest at the edge, gone past the end", () => {
    expect(classFillStrength(-1)).toBe(CLASS_FILL_STOPS[0].alpha);
    expect(classFillStrength(2)).toBe(0);
  });
});

describe("classFill", () => {
  it("is a left-to-right gradient that ends transparent at the reach", () => {
    const css = classFill("#00d0f2", "calc(0.25rem + 2.1rem)");
    expect(css.startsWith("linear-gradient(90deg, ")).toBe(true);
    expect(css).toContain("color-mix(in srgb, #00d0f2 75%, transparent)");
    expect(css.endsWith("transparent calc(calc(0.25rem + 2.1rem) * 1))")).toBe(
      true
    );
  });

  it("takes any CSS colour, including a darkened sixth class", () => {
    const sixth = "color-mix(in oklab, #00d0f2 70%, black)";
    expect(classFill(sixth, "2rem")).toContain(`color-mix(in srgb, ${sixth} `);
  });
});

describe("white position digits on the fill", () => {
  // The left edge of a two-digit position on Standings: the row's 4 px
  // padding, then ~12 px into the 33.6 px position cell, of a 37.6 px reach.
  // The digits' centre, and every Relative layout, sit further along and so
  // on a thinner fill — this is the worst place a digit is drawn.
  const DIGIT_EDGE = 1 / 3;
  const strength = classFillStrength(DIGIT_EDGE);

  for (const color of CLASS_RAMP) {
    for (const [name, ground] of [
      ["neutral strip", NEUTRAL_ROW],
      ["player's strip", PLAYER_ROW],
    ] as const) {
      it(`clear 4.5:1 on ${color} over the ${name}`, () => {
        const fill = over(hex(color), strength, ground);
        expect(whiteContrastOn(fill)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

function contrast(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(toHex(a))!;
  const lb = relativeLuminance(toHex(b))!;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe("a class name against its outline", () => {
  // The name sits on the strongest part of the fill; take the worst case of
  // the class colour at full strength under the outline, with the name in that
  // same colour inside it.
  const black = Number(/0\.\d+/.exec(CLASS_NAME_OUTLINE)![0]);

  for (const color of CLASS_RAMP) {
    it(`clears 4.5:1 in ${color} over ${color}`, () => {
      const chip = over([0, 0, 0], black, hex(color));
      expect(contrast(hex(color), chip)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
