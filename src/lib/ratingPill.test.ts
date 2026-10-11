import { describe, expect, it } from "vitest";

import {
  CHANGE_RULE_PX,
  CHANGE_SLOT_W,
  LICENCE_L_DEEP,
  LICENCE_L_LIGHT,
  licenceGround,
  licenceStops,
  RATING_PAD_X,
  ratingGround,
} from "./ratingPill";
import { relativeLuminance } from "./contrast";

/** iRacing's licence colours (`LicColor`), Rookie to Pro. */
const LICENCES: Record<string, string> = {
  R: "#fc0706",
  D: "#ff8c00",
  C: "#feec04",
  B: "#00c702",
  A: "#0153db",
  P: "#000000",
};

const lum = (hex: string) => relativeLuminance(hex)!;
const whiteOn = (hex: string) => 1.05 / (lum(hex) + 0.05);

/** Hue angle in degrees, from sRGB hex — independent of the module's OKLab. */
function hslHue(hex: string): number {
  const v = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => c / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return NaN;
  const h =
    max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

describe("licenceGround", () => {
  it("is a top-lit gradient between the segment's two stops", () => {
    const [light, deep] = licenceStops("#0153db");
    expect(licenceGround("#0153db")).toBe(
      `linear-gradient(180deg, ${light}, ${deep})`
    );
  });

  it("goes from light to deep", () => {
    expect(LICENCE_L_LIGHT).toBeGreaterThan(LICENCE_L_DEEP);
    for (const color of Object.values(LICENCES)) {
      const [light, deep] = licenceStops(color);
      expect(lum(light)).toBeGreaterThan(lum(deep));
    }
  });

  // The light end is the worst place white is drawn; the deep end only gets
  // darker. B's green is the closest call.
  for (const [group, color] of Object.entries(LICENCES)) {
    it(`keeps white above 4.5:1 on ${group} (${color}) at its lightest`, () => {
      expect(whiteOn(licenceStops(color)[0])).toBeGreaterThanOrEqual(4.5);
    });
  }

  // What the old toward-black mix lost: the colour itself. Each licence keeps
  // its hue, to within what rounding to 8-bit sRGB moves it.
  for (const [group, color] of Object.entries(LICENCES)) {
    if (group === "P") continue;
    it(`keeps ${group}'s hue at both ends`, () => {
      for (const stop of licenceStops(color)) {
        expect(hueGap(hslHue(stop), hslHue(color))).toBeLessThan(6);
      }
    });
  }

  it("keeps A's blue its own colour, since it is already dark enough", () => {
    expect(licenceStops(LICENCES.A)[0]).toBe(LICENCES.A);
  });

  it("draws P's black as a black segment the row can still see", () => {
    const [light] = licenceStops(LICENCES.P);
    expect(lum(light)).toBeGreaterThan(0);
    expect(hslHue(light)).toBeNaN(); // still neutral
  });

  it("falls back to a neutral segment for a colour it cannot read", () => {
    const [light] = licenceStops("not-a-colour");
    expect(hslHue(light)).toBeNaN();
    expect(whiteOn(light)).toBeGreaterThanOrEqual(4.5);
  });

  it("reads three-digit hex", () => {
    expect(licenceStops("#f00")).toEqual(licenceStops("#ff0000"));
  });
});

describe("ratingGround", () => {
  it("is a plain glass lift with no change to grade", () => {
    const css = ratingGround(0);
    expect(css).not.toContain("--color-accent");
    expect(css).not.toContain("--color-danger");
  });

  it("rules a gain in accent and a loss in danger", () => {
    expect(ratingGround(14)).toContain("var(--color-accent)");
    expect(ratingGround(-3)).toContain("var(--color-danger)");
  });

  it("rules under the change's slot, along the foot", () => {
    expect(ratingGround(14)).toContain(
      `right ${RATING_PAD_X} bottom 0 / ${CHANGE_SLOT_W} ${CHANGE_RULE_PX}px no-repeat`
    );
  });

  it("draws the rule over the lift, not under it", () => {
    const css = ratingGround(14);
    expect(css.indexOf("--color-accent")).toBeLessThan(css.indexOf("180deg"));
  });
});
