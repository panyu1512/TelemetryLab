/**
 * The position block's flash when a car changes place.
 *
 * For a few seconds after a pass, the Standings position block becomes a chip
 * on a status fill — `▲ 3` on `accent` for the car that gained, `▼ 4` on
 * `danger` for the car that lost. The rows already *glide* to their new slots,
 * but a glide is over in 220 ms and is switched off entirely under reduced
 * motion; a driver who glances over a second later sees a table in a new order
 * with nothing to say what changed. The flash holds the answer long enough to
 * be caught in peripheral vision, and keeps the new position on it: the arrow
 * says what happened, the number is still the one the column is for.
 *
 * The cumulative `▲2` beside the block is a different fact — places won or
 * lost since the start — so the two never stand in for each other.
 */

/** Which way a car just moved in the running order. */
export type PositionMove = "up" | "down";

/**
 * One flash: which way, and an id that is new for every change of place, so
 * a car passed twice inside the hold starts its flash over rather than
 * inheriting the first one's half-finished fade.
 */
export interface PositionFlash {
  move: PositionMove;
  id: number;
}

/** How long the block holds the flash after a change, in ms. */
export const POSITION_FLASH_MS = 3000;

/**
 * The move between two printed positions, or `null` when there is nothing to
 * flash: no change, or either side unknown. iRacing reports position 0 for a
 * car that has not been classified yet, so anything below 1 is unknown too —
 * otherwise every car on the grid would flash "up" when the start classifies
 * the field.
 */
export function positionMove(
  before: number | null | undefined,
  after: number | null | undefined,
): PositionMove | null {
  if (before == null || after == null) return null;
  if (before < 1 || after < 1 || before === after) return null;
  return after < before ? "up" : "down";
}
