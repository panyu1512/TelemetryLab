/**
 * Who is in a fight: a car within a second of the car ahead of it *in its own
 * class*, both of them racing.
 *
 * The tower highlights the interval of the chasing car. It is resolved here,
 * over the whole field, rather than in the row: a row only knows its own car,
 * and whether the car ahead is in the pits or parked is half of the answer —
 * one second behind a car in the pit lane is not a battle, it is a pit stop.
 */

import type { StandingsEntry } from "../telemetry/types";

/** Within this many seconds of the car ahead in class is a battle. */
export const BATTLE_GAP_S = 1.0;

/** Racing: in the world, off pit road, not parked and not disqualified. */
export function isRacing(e: StandingsEntry | undefined): boolean {
  if (!e) return false;
  return (
    e.isInWorld &&
    !e.isRetired &&
    !e.onPitRoad &&
    !e.isInPitStall &&
    !e.isDisqualified &&
    !e.hasFinished
  );
}

/**
 * Measured against the gap *as printed* — to the tenth — so the highlight never
 * lands on a value that reads `+1.0`. A 0.96 s interval is shown as one second,
 * and a pill claiming "within a second" around it would be arguing with the
 * number inside it.
 */
function within(gap: number | null | undefined): boolean {
  if (gap == null || !Number.isFinite(gap) || gap < 0) return false;
  return Math.round(gap * 10) < Math.round(BATTLE_GAP_S * 10);
}

/**
 * Cars in a battle, measured the way a **class-grouped** table reads: each
 * class's own order, and the interval to the car ahead in class.
 */
export function classBattles(
  classOrders: readonly (readonly number[])[],
  byIdx: Readonly<Record<number, StandingsEntry>>,
): Set<number> {
  const out = new Set<number>();
  for (const order of classOrders) {
    for (let i = 1; i < order.length; i++) {
      const car = byIdx[order[i]];
      const ahead = byIdx[order[i - 1]];
      if (!car || car.classGapIsLaps) continue;
      if (within(car.classInterval) && isRacing(car) && isRacing(ahead)) out.add(car.carIdx);
    }
  }
  return out;
}

/**
 * Cars in a battle, measured the way a **flat overall** table reads: the car
 * directly ahead on the timesheet, which only counts when it is the same class.
 * A GT4 half a second behind a GT3 is traffic, not a fight.
 */
export function overallBattles(
  order: readonly number[],
  byIdx: Readonly<Record<number, StandingsEntry>>,
): Set<number> {
  const out = new Set<number>();
  for (let i = 1; i < order.length; i++) {
    const car = byIdx[order[i]];
    const ahead = byIdx[order[i - 1]];
    if (!car || !ahead || car.gapIsLaps || car.carClassId !== ahead.carClassId) continue;
    if (within(car.interval) && isRacing(car) && isRacing(ahead)) out.add(car.carIdx);
  }
  return out;
}

/** Same members, regardless of order — used to keep a set's identity stable. */
export function sameSet(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
