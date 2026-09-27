/**
 * Contrast helpers for the one colour in this app that the design system does
 * not own: `carClassColor`, supplied per class by iRacing.
 *
 * `design.md` § Theme rule 1 says `--color-on-accent` is the only ink allowed on
 * a filled status surface, and that holds because every *status* colour in this
 * palette is light by construction. Identity colour is not: a class can land on
 * anything, including a navy or a maroon that dark ink disappears into. So a
 * filled class chip picks its ink from the fill's measured luminance instead of
 * assuming one.
 */

/** Parse `#rgb` / `#rrggbb` (with or without the hash) to 0–255 channels. */
function parseHex(color: string): [r: number, g: number, b: number] | null {
  const hex = color.trim().replace(/^#/, "");
  if (hex.length === 3) {
    const [r, g, b] = hex;
    const v = parseInt(`${r}${r}${g}${g}${b}${b}`, 16);
    return Number.isNaN(v) ? null : [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  if (hex.length === 6) {
    const v = parseInt(hex, 16);
    return Number.isNaN(v) ? null : [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  return null;
}

/** sRGB channel → linear, per WCAG 2.x. */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * WCAG relative luminance, 0 (black) to 1 (white). Returns `null` for anything
 * that isn't a parseable hex — callers treat that as "assume dark", which is
 * the safe default on this app's dark surfaces.
 */
export function relativeLuminance(color: string): number | null {
  const rgb = parseHex(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(linearize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The ink to print on top of an arbitrary fill.
 *
 * The 0.4 threshold is chosen so both branches clear 4.5:1 against the worst
 * fill that reaches them: at L=0.4 dark ink (`on-accent`, L≈0.03) measures
 * ≈ 6.7:1 and white measures ≈ 2.2:1, so the crossover sits well inside the
 * dark branch's comfort rather than on the boundary.
 */
export function readableInk(fill: string): string {
  const lum = relativeLuminance(fill);
  if (lum == null) return "oklch(100% 0 0)";
  return lum >= 0.4 ? "var(--color-on-accent)" : "oklch(100% 0 0)";
}

/**
 * WCAG contrast ratio between two hex colours, 1–21. `null` when either side
 * isn't a parseable hex (a `color-mix()` string, a CSS variable).
 */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  if (la == null || lb == null) return null;
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Composite `rgba(r,g,b,a)` over an opaque hex ground, the way a browser
 * paints a translucent tint, and return the result as hex. A plain hex `fg`
 * comes back unchanged. Used to measure ink that sits on a tint.
 */
export function composite(fg: string, bg: string): string {
  const m = fg
    .replace(/\s+/g, "")
    .match(/^rgba\((\d+),(\d+),(\d+),([\d.]+)\)$/i);
  if (!m) return fg;
  const base = parseHex(bg);
  if (!base) return fg;
  const a = Number(m[4]);
  const mix = [Number(m[1]), Number(m[2]), Number(m[3])].map((c, i) =>
    Math.round(c * a + base[i] * (1 - a))
  );
  return `#${mix.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * OKLCH of a hex colour: lightness 0–1, chroma, hue in degrees (0 for a grey).
 * `null` for anything that isn't a parseable hex. The hue is what the class
 * colour picker measures a pick against, so a warning means the same thing to
 * the eye whatever the lightness.
 */
export function toOklch(color: string): { l: number; c: number; h: number } | null {
  const rgb = parseHex(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(linearize);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(A, B);
  const h = c < 1e-4 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

/** Shortest distance between two hues, in degrees (0–180). */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * A **tint**: the same hue as `color`, at `alpha`, as a ground for coloured ink.
 *
 * Deliberately a different device from a *fill* (`design.md` § Dense tabular
 * overlays, rule 5). A fill is opaque and takes contrasting ink, and the rules
 * ration it to one meaning per surface because it is the loudest tool there. A
 * tint is a whisper of the same colour behind ink of that colour — it groups a
 * compound cell without competing with a fill for attention, which is what lets
 * the licence badge and the tyre cell read as chips without spending the
 * surface's one fill.
 */
export function tint(color: string, alpha = 0.16): string {
  return `color-mix(in oklab, ${color} ${Math.round(alpha * 100)}%, transparent)`;
}
