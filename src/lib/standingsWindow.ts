/**
 * Which rows of a class group the Standings shows, when it is not showing all
 * of them.
 *
 * Fitting the whole grid into the window (`lib/tableScale.fitScale`) kept every
 * car on screen, but a 40-car field in an overlay sized to sit beside the
 * mirrors drew 13 px names at a third of their size — the whole field, and
 * none of it readable at speed. The Relative never had that problem because it
 * shows a fixed number of cars and lets the window decide only how large they
 * are drawn. This brings the Standings to the same footing.
 *
 * A capped group keeps the two parts of the field a driver actually reads:
 *
 *   - **The leaders** — the top of the class, always: who is winning, and the
 *     reference every gap is measured from.
 *   - **The player's neighbourhood** — the cars around them in the running
 *     order, the ones they are racing.
 *
 * Between the two, when they do not meet, the layout draws a skip marker so the
 * break in the order is visible rather than looking like P3 is followed by P14.
 * A group the player is not in (another class) has no neighbourhood and simply
 * shows its top rows.
 */

/** Rows of a class group to draw, and where the order breaks. */
export interface GroupSlice {
  /** Indices into the group's order, ascending. */
  positions: number[];
  /**
   * Index into {@link positions} before which the order skips cars (the first
   * row of the player's window), or null when the rows are contiguous.
   */
  breakAt: number | null;
}

/** Leaders kept above the player's window, for a given row budget. */
export function leaderCount(max: number): number {
  return Math.max(1, Math.min(3, Math.floor(max / 4)));
}

/**
 * The rows of a group of `length` cars to draw, at most `max` of them, keeping
 * the player (at `playerPos`, or -1 if not in this group) on screen.
 *
 * The player's window holds a car or so more behind than ahead: the cars
 * behind are the ones closing on you, and on a timesheet they are the ones you
 * might yet drop behind. `max <= 0` means no cap.
 */
export function sliceGroup(length: number, playerPos: number, max: number): GroupSlice {
  const all = (n: number): GroupSlice => ({
    positions: Array.from({ length: n }, (_, i) => i),
    breakAt: null,
  });
  if (max <= 0 || length <= max) return all(length);
  if (playerPos < 0 || playerPos >= length) return all(max);

  const leaders = leaderCount(max);
  const rest = max - leaders;
  const ahead = Math.floor((rest - 1) / 2);
  const start = Math.min(playerPos - ahead, length - rest);

  // The window reaches the leaders: one contiguous block from P1 holds the
  // player, so there is nothing to skip.
  if (start <= leaders) return all(max);

  const positions: number[] = [];
  for (let i = 0; i < leaders; i++) positions.push(i);
  for (let i = start; i < start + rest; i++) positions.push(i);
  return { positions, breakAt: leaders };
}
