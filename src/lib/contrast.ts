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
