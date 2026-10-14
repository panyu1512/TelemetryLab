/**
 * The colours that say which class a car is in — multiclass sessions only.
 *
 * In the race-engineer look these are the one exception to "no decorative
 * colour": in a multiclass race the class is functional and has to be found at
 * a glance. They are carried sparingly — a thin bar on the left of a row, a
 * small tag next to the car number, a chart line — and never as a row's
 * ground, a panel's background or a block of text. A single-class session
 * shows none of them.
 *
 * Identity colour is the app's, not the sim's. iRacing's own `carClassColor`
 * hands out whatever hue it likes — the stock GT3 colour is `#ff4d4d` — and
 * this app spends red on loss, blue on lapped traffic, yellow on warnings and
 * cyan on selection. So the ramp is chosen against those, rather than sampled
 * from the sim:
 *
 * | reserved      | hue     | why it is out of bounds                        |
 * |---------------|---------|------------------------------------------------|
 * | `danger`      | 22      | loss, off-track, a faster class closing         |
 * | `warning`     | 90      | pit road, incident count, caution flags         |
 * | `accent`      | 152     | gain, personal best, fastest lap in class       |
 * | `primary`     | 222–234 | THE accent — selection, focus, "this is you"    |
 * | `lapped`      | 245     | lapped traffic on the Relative (fixed, unthemed)|
 *
 * Every entry clears its nearest reserved hue by more than 25°. They are a
 * step desaturated (OKLCH chroma 0.10–0.12) so they sit in the graphite
 * ground rather than glowing on it, and light enough to read as a 3 px bar.
 *
 * The order is not arbitrary. Consecutive entries are the colours of
 * consecutive class *groups* down the screen, so the list puts the largest hue
 * steps between neighbours — every adjacent pair is more than 100° apart.
 *
 * The same five values are the `--color-class-1…5` tokens in `styles.css`
 * (aliased as `--class-1…5`); `classColors.tokens.test.ts` holds the two
 * together.
 */

/**
 * Five classes' worth of identity colour, in the order groups are drawn.
 *
 * Five because that is the top of what iRacing runs, and because past five
 * the hue wheel has nothing honest left once the status colours and the
 * accent are spoken for. A sixth class is handled by {@link classColorFor}.
 */
export const CLASS_RAMP: readonly string[] = [
  "#52bfb8", // teal    — 189°
  "#e4965b", // orange  —  57°
  "#9394e7", // violet  — 282°
  "#b2ca6f", // lime    — 121°
  "#d387c2", // pink    — 335°
];

/**
 * The identity colour for the class at `index` in the field's class order.
 *
 * Indexed by position rather than keyed by `carClassId` on purpose. The classes
 * arrive sorted by strength of field, so position is stable for the length of a
 * session and adjacent groups are guaranteed the colours this ramp spaced
 * apart. Keying by class id would be stable across *sessions* instead, at the
 * cost of two classes in one race being able to hash to neighbouring hues —
 * which is the failure this ramp exists to prevent.
 *
 * Past the end of the ramp the colours darken by cycle rather than repeat, so a
 * sixth class is a deeper cyan than the first rather than the same cyan. Six
 * classes in one race is not a thing iRacing does; this is here so the function
 * is total, not because the sixth colour is any good.
 */
export function classColorFor(index: number): string {
  const base = CLASS_RAMP[index % CLASS_RAMP.length];
  const cycle = Math.floor(index / CLASS_RAMP.length);
  if (cycle <= 0) return base;
  const keep = Math.max(35, 100 - cycle * 30);
  return `color-mix(in oklab, ${base} ${keep}%, black)`;
}
