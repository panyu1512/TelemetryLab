/**
 * Lap relation between a car on the Relative screen and the player.
 *
 * The Relative screen sorts by `intervalToPlayer`, which the bridge wraps to
 * ±half a lap. That wrap is what makes this module necessary: a car a lap down
 * that is physically alongside the player shows a *small* gap, identical to a
 * car actually racing them. Time alone cannot tell the two apart, so the screen
 * has to compare lap progress to know whether a neighbour is real competition,
 * traffic being lapped, or a faster car coming through.
 *
 * Two things make this subtler than subtracting lap numbers:
 *
 *   1. `StandingsEntry.isLapped` / `lapsDown` are **leader-relative** — they say
 *      nothing about the player, who may be lapped themselves. Two cars both a
 *      lap down on the leader are on the *same* lap as each other.
 *   2. Lap *numbers* tick over at the start/finish line. A car two seconds
 *      behind a player who has just crossed the line is a lap number lower
 *      while being on the same racing lap. Comparing `lap` alone would label
 *      every neighbour behind as lapped traffic for the width of the pit
 *      straight, every single lap.
 *
 * Both are handled by comparing *fractional* progress (`lap + lapDistPct`) and
 * rounding: cars physically near each other differ by well under half a lap, so
 * their rounded delta is 0 regardless of which side of the line they sit on.
 */

import type { StandingsEntry } from "../telemetry/types";

/**
 * How a car on the Relative screen stands relative to the player, in laps.
 *
 * `unknown` is a first-class member rather than a null: lap data is missing for
 * a few frames after joining a session, and a car whose relation we cannot
 * compute must render as ordinary rather than guess a colour.
 */
export const LapRelation = {
  /** Racing the player on the same lap — genuine competition. */
  SameLap: "same-lap",
  /** At least a lap behind the player: traffic the player is lapping. */
  Lapping: "lapping",
  /** At least a lap ahead of the player: a faster car coming through. */
  LappedBy: "lapped-by",
  /** Lap progress unavailable for either car. */
  Unknown: "unknown",
} as const;

export type LapRelation = (typeof LapRelation)[keyof typeof LapRelation];

/** The subset of an entry this module needs — anything lap-positioned works. */
export type LapPositioned = Pick<StandingsEntry, "lap" | "lapDistPct">;

/**
 * Fractional lap progress, or null when the car has no usable position yet.
 * `lapDistPct` is treated as optional progress within the lap so a car with a
 * lap number but no distance still compares sensibly.
 */
function progress(car: LapPositioned): number | null {
  if (car.lap == null) return null;
  const pct = car.lapDistPct;
  return car.lap + (pct != null && Number.isFinite(pct) ? pct : 0);
}

/**
 * Whole laps `car` is ahead of (positive) or behind (negative) `player`, or
 * null when either car's progress is unknown.
 *
 * Rounding is what absorbs the start/finish wrap: a neighbour anywhere within
 * half a lap of the player rounds to 0, so only a genuine full-lap difference
 * is reported.
 */
export function lapDelta(
  car: LapPositioned,
  player: LapPositioned,
): number | null {
  const a = progress(car);
  const b = progress(player);
  if (a == null || b == null) return null;
  // `+ 0` normalizes the -0 that Math.round returns for a small negative delta,
  // so a same-lap car compares and formats identically either side of zero.
  return Math.round(a - b) + 0;
}

/** Classify a car's lap standing relative to the player. */
export function lapRelation(
  car: LapPositioned,
  player: LapPositioned,
): LapRelation {
  const delta = lapDelta(car, player);
  if (delta == null) return LapRelation.Unknown;
  if (delta > 0) return LapRelation.LappedBy;
  if (delta < 0) return LapRelation.Lapping;
  return LapRelation.SameLap;
}

/**
 * True when the car is not on the player's lap — the condition the Relative
 * screen colours on, either direction.
 */
export function isOffLap(relation: LapRelation): boolean {
  return relation === LapRelation.Lapping || relation === LapRelation.LappedBy;
}

/**
 * Compact lap-difference tag, e.g. `+1L` / `-2L`, or null when there is nothing
 * to say. Direction is carried by the sign so the screen needs only one hue.
 */
export function lapTag(delta: number | null): string | null {
  if (delta == null || delta === 0) return null;
  return `${delta > 0 ? "+" : "-"}${Math.abs(delta)}L`;
}
