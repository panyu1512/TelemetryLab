/**
 * Ranking the field by best lap, for the sessions where that *is* the ranking
 * (see `lib/sessionKind`).
 *
 * The bridge orders the field by iRacing's `CarIdxPosition`, tiebroken by track
 * progress — the right answer in a race, and an unreliable one outside it: in a
 * practice session `CarIdxPosition` is whatever the sim happens to publish, and
 * the tiebreak degrades to "who is furthest around the lap", which ranks a
 * driver on an out-lap above one who has just set the session best.
 *
 * So a lap-time session gets its order derived here instead, from the one
 * number that is unambiguous: the best lap itself. Deriving it on the client
 * also keeps the rank and the `Best` column reading from the same value, which
 * is what stops the table showing P3 next to the fastest time on the board.
 */

/**
 * Car indices ranked by best lap: fastest first, then every car that has not
 * set one, in the order they arrived.
 *
 * Cars without a lap keep their incoming sequence rather than being dropped or
 * sorted among themselves — in a practice session half the field is in the
 * garage at any moment, and a driver who has not run yet still belongs on the
 * timesheet. `Array.prototype.sort` is stable, so that ordering survives.
 *
 * Non-positive and non-finite times count as "no lap": iRacing publishes `0`
 * and `-1` for a lap that was never set, and sorting those to the front would
 * put the whole garage above the session leader.
 */
export function orderByBestLap(
  carIdxs: readonly number[],
  bestLapOf: (carIdx: number) => number | null | undefined,
): number[] {
  const timed = new Map<number, number>();
  for (const idx of carIdxs) {
    const t = bestLapOf(idx);
    if (t != null && Number.isFinite(t) && t > 0) timed.set(idx, t);
  }
  return [...carIdxs].sort((a, b) => {
    const ta = timed.get(a);
    const tb = timed.get(b);
    if (ta == null && tb == null) return 0; // both untimed — stable, keep order
    if (ta == null) return 1; // untimed cars sink
    if (tb == null) return -1;
    return ta - tb;
  });
}
