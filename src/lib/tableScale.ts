/**
 * Fitting the timing tables to their window by **scaling**, not by shedding.
 *
 * These two surfaces used to answer a narrowing overlay by dropping columns —
 * sectors first, then position change, tyre, licence, iRating, and on down a
 * priority list. It kept the type at full size, which was the point: this is
 * the one surface read in peripheral vision, so the type runs a step large
 * (`design.md` § Dense tabular overlays, rule 8). The cost was that making the
 * overlay smaller silently changed *what it showed*. A driver who sized their
 * standings to fit beside the mirrors lost the sector deltas and had no way to
 * know they had been dropped rather than never sent.
 *
 * The table now shrinks whole. Every column the session calls for stays on
 * screen at every size, and the surface scales to fit them — one number
 * multiplying type, rows, gaps and column widths together, so the layout that
 * was tuned at full size is the same layout at half.
 *
 * Nothing here is about *which* columns to show. Session scoping still hides
 * the columns that would lie outside a race (`scopeColumnsToSession`); this
 * module only asks how large what is left can be drawn.
 */

import type { CSSProperties } from "react";

/**
 * How far the table may shrink before it stops shrinking.
 *
 * A backstop, not a recommendation. Its job is to stop a table dragged to a
 * sliver from scaling into nothing; it is not a claim that half-size type is
 * comfortable to read at speed. Past this point the surface goes back to
 * scrolling sideways, which at least fails visibly.
 */
export const MIN_TABLE_SCALE = 0.5;

/**
 * The factor to draw the table at, given the width it has and the width it
 * wants.
 *
 * Never above 1: a wide overlay is a table with room around it, not a table
 * blown up. Growing to fill would make the surface's type a function of window
 * size in both directions, and the size it is at 1 is the size rule 8 argued
 * for.
 *
 * An unmeasured or nonsensical width (0 on first paint, before the
 * ResizeObserver reports) draws at full size — the same "show everything and
 * let it clip" default the session strip takes, and it lasts one frame.
 */
export function tableScale(available: number, natural: number): number {
  if (!Number.isFinite(available) || available <= 0) return 1;
  if (!Number.isFinite(natural) || natural <= 0) return 1;
  return Math.min(1, Math.max(MIN_TABLE_SCALE, available / natural));
}

/**
 * A length in the table's own coordinates, given one in the window's.
 *
 * Inside the scaled surface, a component that decides anything from a width —
 * the session strip and the class band both drop fields as they narrow — must
 * be told the width it *has to draw in*, which is larger than the window's by
 * exactly the scale. Handing it the window's own width would have it shedding
 * fields at the very sizes this module exists to keep them at.
 */
export function unscaled(length: number, scale: number): number {
  return scale > 0 ? length / scale : length;
}

/**
 * The style that puts a subtree into the table's scale.
 *
 * `zoom` rather than `transform: scale()`. A transform rasterises what it
 * scales: the browser lays the table out at full size and resamples the result,
 * which softens 12 px tabular digits at exactly the sizes where they are
 * hardest to read. `zoom` re-lays the subtree out at the smaller size, so the
 * glyphs are hinted and snapped like any other text on the screen. It also
 * leaves scrolling and hit-testing in ordinary coordinates rather than
 * transformed ones.
 *
 * The scale rides along as a custom property so the few things that must *not*
 * shrink with everything else can divide it back out — see `CLASS_EDGE_WIDTH`.
 * Both screens go through here so there is exactly one definition of what being
 * scaled means.
 */
export function scaleBox(scale: number): CSSProperties {
  return { zoom: scale, "--table-scale": scale } as CSSProperties;
}
