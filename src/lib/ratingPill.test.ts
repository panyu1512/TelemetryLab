import { describe, expect, it } from "vitest";

import {
  CHANGE_RULE_PX,
  LICENCE_MIX_DEEP,
  LICENCE_MIX_LIGHT,
  licenceGround,
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

// sRGB ⇄ OKLab, so the test mixes exactly as `color-mix(in oklab, …)` does.
const lin = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const enc = (c: number) => {
  const v = Math.min(1, Math.max(0, c));
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
};

function toOklab(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) =>
    lin(c / 255)
  );
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, a, b]: [number, number, number]): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${rgb
    .map((c) => Math.round(enc(c) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

/** `color-mix(in oklab, color pct%, black)`; black is the OKLab origin. */
function towardBlack(hex: string, pct: number): string {
  return fromOklab(toOklab(hex).map((c) => (c * pct) / 100) as [number, number, number]);
}

const whiteOn = (hex: string) => 1.05 / (relativeLuminance(hex)! + 0.05);

describe("licenceGround", () => {
  it("is a diagonal gradient between the two mixes of the licence colour", () => {
    const css = licenceGround("#0153db");
    expect(css.startsWith("linear-gradient(135deg, ")).toBe(true);
    expect(css).toContain(`#0153db ${LICENCE_MIX_LIGHT}%, black`);
    expect(css).toContain(`#0153db ${LICENCE_MIX_DEEP}%, black`);
  });

  it("goes from light to deep", () => {
    expect(LICENCE_MIX_LIGHT).toBeGreaterThan(LICENCE_MIX_DEEP);
  });

  // The light end is the worst place white is drawn; the deep end only gets
  // darker. C's yellow is the closest call.
  for (const [group, color] of Object.entries(LICENCES)) {
    it(`keeps white above 4.5:1 on ${group} (${color}) at its lightest`, () => {
      expect(whiteOn(towardBlack(color, LICENCE_MIX_LIGHT))).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("ratingGround", () => {
  it("is a plain glass lift with no change to grade", () => {
    const css = ratingGround(0);
    expect(css).not.toContain("--color-accent");
    expect(css).not.toContain("--color-danger");
  });

  it("rules a gain in accent and a loss in danger, along the foot", () => {
    expect(ratingGround(14)).toContain("var(--color-accent)");
    expect(ratingGround(-3)).toContain("var(--color-danger)");
    expect(ratingGround(14)).toContain(`bottom / 100% ${CHANGE_RULE_PX}px no-repeat`);
  });

  it("draws the rule over the lift, not under it", () => {
    const css = ratingGround(14);
    expect(css.indexOf("--color-accent")).toBeLessThan(css.indexOf("180deg"));
  });
});
