/**
 * The grounds of the licence / iRating pill on Standings (`A3.45 | 8895 ▲14`).
 *
 * The two segments read as one lit object — both brighter at the top, with
 * {@link PILL_SHEEN} along their top edge — without spending any of the
 * contrast the digits on them need:
 *
 * - **the licence segment** is the licence's own colour, held at a lightness
 *   white reads on. It used to be the colour taken toward black, and mixing
 *   toward black in OKLab scales chroma down with lightness: at the deep end
 *   A's blue was navy, R's red was maroon and C's yellow was mud, so the one
 *   thing the segment is for — telling the class of licence at a glance — was
 *   the thing it did worst. Holding the hue and spending the chroma the sRGB
 *   gamut has left at that lightness keeps every licence the colour a driver
 *   knows it by, and white still clears 4.5:1 on all of them (see the test;
 *   B's green is the closest call);
 * - **the iRating segment** is a neutral glass lift, kept darker than the
 *   licence segment so the rating's white digits are the strongest thing on
 *   it. Its projected change is graded a second time by a **rule** under the
 *   change — green for a gain, red for a loss. A rule, not a tint, for the
 *   reason the last-lap cell is ruled (`design.md` § Dense tabular overlays,
 *   rule 10): a status-coloured ground under status-coloured ink costs that
 *   ink its contrast, and a rule costs nothing.
 */

/* -------------------------------------------------------------------------- */
/*  OKLab / OKLCH                                                              */
/* -------------------------------------------------------------------------- */

type Rgb = [r: number, g: number, b: number];
type Lch = [l: number, c: number, h: number];

/** Parse `#rgb` / `#rrggbb` to linear-light sRGB channels, 0–1. */
function hexToLinear(color: string): Rgb | null {
  let hex = color.trim().replace(/^#/, "");
  if (hex.length === 3) hex = hex.replace(/./g, (ch) => ch + ch);
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  const v = parseInt(hex, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
}

function linearToHex(rgb: Rgb): string {
  return `#${rgb
    .map((c) => {
      const v = Math.min(1, Math.max(0, c));
      const s = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
      return Math.round(s * 255).toString(16).padStart(2, "0");
    })
    .join("")}`;
}

/** Linear sRGB → OKLCH (Björn Ottosson's OKLab, in polar form). */
function linearToOklch([r, g, b]: Rgb): Lch {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
}

function oklchToLinear([L, C, h]: Lch): Rgb {
  const A = C * Math.cos(h);
  const B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb: Rgb) => rgb.every((c) => c >= -1e-6 && c <= 1 + 1e-6);

/**
 * `color` at OKLab lightness `l`, keeping its hue and as much of its chroma as
 * sRGB can show at that lightness. Chroma is bisected down to the gamut edge
 * rather than clipped per channel, since clipping shifts both hue and
 * lightness — the two things this exists to hold.
 */
function atLightness([, c, h]: Lch, l: number): string {
  if (inGamut(oklchToLinear([l, c, h]))) return linearToHex(oklchToLinear([l, c, h]));
  let lo = 0;
  let hi = c;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToLinear([l, mid, h]))) lo = mid;
    else hi = mid;
  }
  return linearToHex(oklchToLinear([l, lo, h]));
}

/* -------------------------------------------------------------------------- */
/*  Licence segment                                                            */
/* -------------------------------------------------------------------------- */

/**
 * OKLab lightness of the licence segment at its lit top and its deep foot.
 * The top is the lightest point white is drawn on, so it is the one the
 * contrast test measures; A's blue is already darker than it and keeps its
 * own lightness.
 */
export const LICENCE_L_LIGHT = 0.52;
export const LICENCE_L_DEEP = 0.42;
/**
 * Lightest a licence colour is ever *lifted to*. P's black would otherwise
 * draw a hole in the row; held here it stays the black licence — a step
 * darker than the iRating segment beside it — and the sheen draws its edge.
 */
export const LICENCE_L_FLOOR = 0.24;

/** iRacing reports no licence colour as white; any unparseable value too. */
const FALLBACK_LICENCE = "#ffffff";

const groundCache = new Map<string, string>();

/** The two stops of a licence segment's ground, lit top then deep foot. */
export function licenceStops(color: string): [light: string, deep: string] {
  const lch = linearToOklch(hexToLinear(color) ?? hexToLinear(FALLBACK_LICENCE)!);
  const light = Math.max(LICENCE_L_FLOOR, Math.min(lch[0], LICENCE_L_LIGHT));
  const deep = Math.max(LICENCE_L_FLOOR * 0.7, light - (LICENCE_L_LIGHT - LICENCE_L_DEEP));
  return [atLightness(lch, light), atLightness(lch, deep)];
}

/**
 * The licence segment's ground: its own colour, lit from the top, as the
 * iRating segment beside it is. Licence colours are a handful per session, so
 * each is worked out once.
 */
export function licenceGround(color: string): string {
  let css = groundCache.get(color);
  if (!css) {
    const [light, deep] = licenceStops(color);
    css = `linear-gradient(180deg, ${light}, ${deep})`;
    groundCache.set(color, css);
  }
  return css;
}

/* -------------------------------------------------------------------------- */
/*  iRating segment                                                            */
/* -------------------------------------------------------------------------- */

/** Thickness of the change rule under the projected change, in px. */
export const CHANGE_RULE_PX = 2;
/**
 * Width of the projected change's slot, and the segment's inline padding. The
 * cell lays the change out in this slot and the rule is drawn under exactly
 * it, so every rule in the column starts and ends on the same verticals.
 */
export const CHANGE_SLOT_W = "1.95rem";
export const RATING_PAD_X = "6px";

/** The iRating segment's glass: lighter at the top, darker than the licence. */
const RATING_LIFT =
  "linear-gradient(180deg, rgb(255 255 255 / 0.11), rgb(255 255 255 / 0.04))";

/**
 * The iRating segment's ground as CSS `background` layers: the change rule (if
 * there is a change) over the glass lift.
 */
export function ratingGround(change: number): string {
  if (!change) return RATING_LIFT;
  const ink = change > 0 ? "var(--color-accent)" : "var(--color-danger)";
  const rule = `linear-gradient(${ink}, ${ink}) right ${RATING_PAD_X} bottom 0 / ${CHANGE_SLOT_W} ${CHANGE_RULE_PX}px no-repeat`;
  return `${rule}, ${RATING_LIFT}`;
}

/** A one-pixel highlight along the pill's top edge, inside it. */
export const PILL_SHEEN = "inset 0 1px 0 rgb(255 255 255 / 0.16)";
