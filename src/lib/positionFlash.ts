/**
 * The position block's flash when a car changes place.
 *
 * For a few seconds after a pass, the Standings position block turns into an
 * arrow on a status fill — up on `accent` for the car that gained, down on
 * `danger` for the car that lost. The rows already *glide* to their new slots,
 * but a glide is over in 220 ms and is switched off entirely under reduced
 * motion; a driver who glances over a second later sees a table in a new order
 * with nothing to say what changed. The flash holds the answer long enough to
 * be caught in peripheral vision.
 *
 * The cumulative `▲2` chip beside the block is a different fact — places won or
 * lost since the start — so the two never stand in for each other.
 */

/** Which way a car just moved in the running order. */
export type PositionMove = "up" | "down";

/** How long the block holds the arrow after a change, in ms. */
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
