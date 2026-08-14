/**
 * Is a tyre readout live, or is it the snapshot from the last pit stop?
 *
 * `*tempCL/CM/CR` are the only per-corner temperatures in iRacing's live shared
 * memory, and for cars that do not carry live telemetry in real life the sim
 * refreshes them **when the car is in the pit stall** — not per frame. The
 * telemetry channel keeps delivering at 60 Hz throughout, carrying the same
 * numbers each time, so nothing downstream can tell the difference by looking
 * at one frame: a held readout and a live one are byte-identical.
 *
 * What separates them is time. Watch a corner's temperatures across frames and
 * a live one moves within seconds (carcass temperature drifts a tenth of a
 * degree per second or so); a held one does not move at all, for the length of
 * a stint. So we time how long each corner has carried the same values, and the
 * widget says "since last stop" once that passes {@link TYRE_STALE_AFTER_MS}.
 *
 * This module is deliberately pure — no React, no clock of its own — so the
 * rule can be tested directly. The caller supplies `now` and stores the
 * returned state.
 */

import type { TyreData, TyreSet } from "../telemetry/types";

export const TYRE_CORNERS = ["lf", "rf", "lr", "rr"] as const;
export type TyreCorner = (typeof TYRE_CORNERS)[number];

/**
 * How long a corner may hold identical temperatures before we stop presenting
 * it as live.
 *
 * Fifteen seconds is chosen from both sides: real carcass temperature moves
 * well past the tenth of a degree the widget renders within two or three
 * seconds, so a live corner never trips this — while a driver who has left the
 * pits notices the badge within a corner or two rather than a lap or two.
 */
export const TYRE_STALE_AFTER_MS = 15_000;

/** How long one corner has been carrying the values it currently shows. */
export interface CornerAge {
  /**
   * The temperatures being held, as a comparable key — or null when the corner
   * has no numeric temperature at all. A corner iRacing never populates reads
   * "—" in the widget, and calling *that* stale would blame the pit stall for
   * data that simply is not in this car's telemetry.
   */
  key: string | null;
  /** Timestamp of the first frame that carried {@link key}. */
  since: number;
}

export type TyreAges = Record<TyreCorner, CornerAge>;

/** A corner's temperatures as a comparison key, or null if it has none. */
export function tempKey(tyre: TyreData | null | undefined): string | null {
  if (!tyre) return null;
  const temps = [tyre.tempL, tyre.tempM, tyre.tempR];
  if (!temps.some((v) => typeof v === "number" && !Number.isNaN(v))) return null;
  return temps.join("|");
}

/** Fresh state with every corner's clock starting at `now`. */
export function initTyreAges(now: number): TyreAges {
  return {
    lf: { key: null, since: now },
    rf: { key: null, since: now },
    lr: { key: null, since: now },
    rr: { key: null, since: now },
  };
}

/**
 * Fold one telemetry frame into the ages: a corner whose temperatures changed
 * restarts its clock, one that held keeps the timestamp it already had.
 *
 * Idempotent for a given frame — calling it twice with the same values is the
 * same as calling it once — which is what lets the widget run it during render
 * without React's double-invoke skewing the clocks.
 */
export function advanceTyreAges(
  prev: TyreAges | null,
  tyres: TyreSet | null | undefined,
  now: number,
): TyreAges {
  // No frame at all (no session, socket down): every clock restarts, so data
  // that comes back later is given its full grace period before being judged.
  if (!tyres) return initTyreAges(now);
  if (!prev) prev = initTyreAges(now);

  const next = {} as TyreAges;
  for (const corner of TYRE_CORNERS) {
    const key = tempKey(tyres[corner]);
    const before = prev[corner];
    next[corner] =
      before.key === key ? before : { key, since: now };
  }
  return next;
}

/** Has this corner held the same temperatures past the threshold? */
export function isCornerStale(
  ages: TyreAges,
  corner: TyreCorner,
  now: number,
  after: number = TYRE_STALE_AFTER_MS,
): boolean {
  const { key, since } = ages[corner];
  if (key === null) return false; // nothing to be stale about
  return now - since >= after;
}

/**
 * True only when *every* corner has gone stale — the signature of the pit-only
 * refresh, where all four freeze on the same frame. One corner sitting still
 * while its neighbours move is a car at a steady state, not a dead feed, and
 * does not deserve the badge.
 */
export function allCornersStale(
  ages: TyreAges,
  now: number,
  after: number = TYRE_STALE_AFTER_MS,
): boolean {
  return TYRE_CORNERS.every((c) => isCornerStale(ages, c, now, after));
}

/**
 * How long the readout as a whole has been held, in ms: the *shortest* hold
 * across the corners, so the age we print is one no corner has yet to reach
 * rather than the most alarming of the four.
 */
export function heldForMs(ages: TyreAges, now: number): number {
  return Math.min(...TYRE_CORNERS.map((c) => now - ages[c].since));
}
