/**
 * The colours that say which class a car is in.
 *
 * These used to be iRacing's own `carClassColor`, taken as given. That is where
 * the collision came from: the sim hands out whatever hue it likes — the stock
 * GT3 colour is `#ff4d4d` — and this app spends red on **lapped traffic**. A
 * red-edged row and a red-grounded row then mean two unrelated things, and with
 * four or five classes on track the odds of some class landing on red, on the
 * blue that means "this is you", or on the amber that means "pit", stop being
 * odds at all.
 *
 * So identity colour is now the app's, not the sim's. This ramp is chosen
 * against the four themes' status hues rather than sampled from a wheel:
 *
 * | reserved      | hue     | why it is out of bounds                        |
 * |---------------|---------|------------------------------------------------|
 * | `danger`      | 24–28   | lapped traffic, off-track — the driver's ask    |
 * | `primary`     | 253–257 | "this is you", the other row ground             |
 * | `primary`     | 45      | same, in the Endurance theme, which is orange   |
 * | `warning`     | 81–82   | pit road, incident count                        |
 * | `accent`      | 154–157 | personal best, fastest lap in class             |
 * | `sectorPurple`| 295–302 | session-best lap                                |
 *
 * Every entry clears its nearest reserved hue by at least 25°, with one
 * deliberate exception: **violet sits 3° from `sectorPurple`**. There is simply
 * no room between `primary` at 255 and `sectorPurple` at 300 for a fifth hue,
 * and this is the cheapest collision on the board — `sectorPurple` appears as
 * *ink on one lap time*, transient and rare, where identity colour appears as a
 * row's leading edge and its ground. Different carrier, different place, and
 * never in the same cell.
 *
 * The order is not arbitrary either. Consecutive entries are the colours of
 * consecutive class *groups* down the screen, so the list is arranged to put
 * the largest hue steps between neighbours — every adjacent pair is more than
 * 110° apart, which is what keeps two groups from blurring into each other at
 * the edge of vision.
 */

import { tint } from "./contrast";

/**
 * Five classes' worth of identity colour, in the order groups are drawn.
 *
 * Five because that is the top of what iRacing runs — the brief was "3, 4 or
 * 5" — and because past five the hue wheel has nothing honest left to give
 * once the status colours are spoken for. A sixth class is handled by
 * {@link classColorFor} rather than by squeezing in a sixth hue nobody could
 * tell from its neighbours.
 */
export const CLASS_RAMP: readonly string[] = [
  "#00d0f2", // cyan     — 215°
  "#f071d1", // magenta  — 338°
  "#cbda49", // lime     — 115°
  "#8e6feb", // violet   — 292°
  "#2ab5a6", // teal     — 184°
];

/** Alpha of the full-row class tint, used on the Relative. */
const TINT_ALPHA = 0.14;

/**
 * Strength of the class-colour fill behind a **Standings** row.
 *
 * Fainter than the Relative's full-row wash rather than stronger. The fill
 * stops at the end of the first column now, so it sits directly behind the
 * row's leading number — and a ground under a number it has to keep legible
 * can afford far less than one spread across empty width. It is a bed for the
 * position to sit on, not a bar.
 *
 * Lifted from 0.12 to 0.16 with the band going solid: the stripe is what ties a
 * row back to the block of colour above it, and against a masthead at full
 * strength the old value read as a smudge rather than as the same colour said
 * quietly.
 */
const FILL_ALPHA = 0.16;

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

/**
 * The ground a **Relative** row of this class sits on: the same colour as its
 * leading edge, across the whole row, at a whisper.
 *
 * The edge alone was the whole of identity on these surfaces, and at three
 * pixels it asks the eye to find a hairline before it can tell one group from
 * another. A tint spreads that answer across the row, so class registers from
 * the shape of the block rather than from its border — while staying quiet
 * enough that the values keep their contrast.
 *
 * The Relative keeps the full wash rather than taking Standings' partial fill,
 * and the difference is not an oversight. A Relative is a handful of rows with
 * no grouping and no repetition: its rows are sorted by where cars physically
 * are, so two neighbours in the same class rarely sit together and there is no
 * block of colour for a partial fill to build. Standings is the opposite —
 * runs of same-class rows stacked into groups, which is what gives a leading
 * fill a column of its own to draw.
 *
 * A row only ever wears **one** ground. Where a status ground applies — the
 * player's row, a lapped car's — the tint gives way to it entirely, which is
 * what keeps identity and status from being read as the same statement. That
 * rule is enforced at the call sites, in the two row components.
 */
export function classTint(color: string): string {
  return tint(color, TINT_ALPHA);
}

/**
 * The ground a **Standings** row sits on: the class's colour running in from
 * the left edge, stopping at `extent`, the rest left as bare paper.
 *
 * A hard stop, not a fade. The edge is the point — it gives the colour a shape,
 * and a shape is what the eye picks up from a group of rows without being asked
 * to look. A gradient petering out would read as a smudge behind the values
 * instead, which is the thing a table this dense can least afford.
 *
 * `extent` is a CSS length, not a percentage, and it comes from the column
 * model — `firstColumnStop` in the standings constants. That is what lets the
 * fill land *on* the first column's boundary at any table scale and any column
 * set, instead of near it: a share of the row width would drift across the
 * columns every time one was switched on or off.
 *
 * Same one-ground rule as {@link classTint}: a player or lapped row takes its
 * status ground instead, and its leading edge carries class alone.
 */
export function classRowFill(color: string, extent: string): string {
  const c = tint(color, FILL_ALPHA);
  return `linear-gradient(to right, ${c} 0, ${c} ${extent}, transparent ${extent})`;
}

/**
 * The ground under a class band: the class's colour, **solid**, across the
 * whole row.
 *
 * It used to be a 22 % tint of the same hue, on the argument that identity
 * colour whispers where status colour speaks. What that produced in a
 * four-class field was four bands of roughly equal darkness whose hue you had
 * to look *for*, in a list meant to be parsed without looking — the tint put
 * the class's colour behind the band rather than making it the band.
 *
 * Solid inverts that: a group's masthead is a block of the class's colour, and
 * the rows under it keep the clipped stripe they always had. Masthead solid,
 * rows striped, is the hierarchy — and a block is the one shape the eye finds
 * in peripheral vision without being sent.
 *
 * The cost is real and belongs here rather than in a commit message: filled
 * identity is the loudest device on a surface whose rules ration fill to a
 * single cell (`design.md` § Dense tabular overlays, rule 5). The band gets
 * away with it because it is a *heading* — it carries no timing value a fill
 * could be mistaken for, and there is exactly one per group. Nothing else on
 * this surface may take a solid identity fill.
 *
 * Ink on top is {@link readableInk}'s problem, not this function's: a class
 * colour can land anywhere on the wheel, so the band measures its fill rather
 * than assuming the palette's dark ink will do.
 */
export function classBandFill(color: string): string {
  return color;
}
