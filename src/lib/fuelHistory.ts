/**
 * Per-lap fuel history — pure bookkeeping for the Fuel Calc's lap table.
 *
 * `hooks/useFuelStrategy.ts` already stops at every lap boundary to sample the
 * burn its rolling average is built from. This module turns each of those
 * stops into a row the driver can read back — the lap, what it cost, its lap
 * time and what was left in the tank — so a thirsty lap, a fuel-save lap or a
 * stop shows up as itself rather than vanishing into a five-lap average.
 *
 * The hook owns the state; everything here is side-effect free so the rules
 * for what a lap "cost" are tested in one place. The same {@link closeLap}
 * measurement feeds both the table and the rolling burn, so the two can never
 * disagree about a lap.
 */

/** One completed lap, as the table shows it. */
export interface FuelLap {
  /** The lap this row is for — the one that just ended. */
  lap: number;
  /**
   * Litres the lap burned, or `null` when it could not be measured: the tank
   * was refilled across it, or too little of it was watched to scale up.
   */
  used: number | null;
  /**
   * `used` was scaled up from part of a lap — the first lap after the app
   * starts watching, or an out-lap measured from the pit exit.
   */
  estimated: boolean;
  /** The car was on pit road during the lap, or the tank was refilled. */
  pit: boolean;
  /** Lap time in seconds, once the sim has published it; else `null`. */
  lapTime: number | null;
  /** Litres in the tank as the lap ended. */
  fuelLeft: number;
}

/**
 * Laps the history keeps, newest last. Enough for any sprint race and a long
 * stretch of an endurance one; the oldest rows drop off past it.
 */
export const FUEL_HISTORY_LIMIT = 100;

/**
 * Less of a lap than this and the extrapolation is doing more work than the
 * measurement — the interval is discarded rather than scaled up. Same floor
 * as `hooks/useFuelEstimate.ts` uses.
 */
export const MIN_COVERED = 0.5;

/** An interval that covered at least this much of the lap counts as whole. */
const WHOLE_LAP = 0.99;

/** Below this a "burn" is sensor noise, not fuel. */
const MIN_BURN_L = 0.01;

/** A rise in the tank bigger than this across a lap is a refuel, not noise. */
const REFUEL_L = 0.5;

export interface LapBoundary {
  /** The lap that just ended. */
  lap: number;
  /** Litres at the start of the measured interval (`null` = never seen). */
  startFuel: number | null;
  /** Litres at the line. */
  endFuel: number;
  /**
   * Lap fraction the interval started at, or `null` when it started on the
   * line — a whole lap.
   */
  startPct: number | null;
  /** The car was on pit road at some point during the lap. */
  touchedPit: boolean;
}

/**
 * Close a lap: what it burned, whether that figure was scaled from a part
 * lap, and whether it was a pit lap. The lap time is left `null` here — the
 * sim may publish it a beat after the line, and {@link settleLapTime} fills it
 * in when it lands.
 */
export function closeLap(b: LapBoundary): FuelLap {
  const covered = b.startPct == null ? 1 : 1 - b.startPct;
  let used: number | null = null;
  if (b.startFuel != null && covered >= MIN_COVERED) {
    const burn = (b.startFuel - b.endFuel) / covered;
    if (burn > MIN_BURN_L) used = burn;
  }
  const refuelled = b.startFuel != null && b.endFuel > b.startFuel + REFUEL_L;
  return {
    lap: b.lap,
    used,
    estimated: used != null && covered < WHOLE_LAP,
    pit: b.touchedPit || refuelled,
    lapTime: null,
    fuelLeft: b.endFuel,
  };
}

/** Append a lap, dropping the oldest past `limit`. Never mutates `history`. */
export function appendFuelLap(
  history: readonly FuelLap[],
  lap: FuelLap,
  limit = FUEL_HISTORY_LIMIT,
): FuelLap[] {
  const next = [...history, lap];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

/**
 * Give the newest lap its time, from the sim's last-lap channel as it reads
 * while the *next* lap is under way. Call it on every change of that channel
 * during that lap; it returns `history` itself when nothing changes, so the
 * caller can skip a render.
 *
 * The channel can lag the lap counter, so at the line it may still hold the
 * lap before's time. That value is recognised — it is what the previous row
 * already carries — and ignored until the real one arrives, rather than being
 * printed against the wrong lap.
 */
export function settleLapTime(
  history: readonly FuelLap[],
  lastLapTime: number | null,
): readonly FuelLap[] {
  if (lastLapTime == null || !(lastLapTime > 0)) return history;
  const latest = history[history.length - 1];
  if (!latest || latest.lapTime === lastLapTime) return history;
  const before = history[history.length - 2];
  if (before && before.lap === latest.lap - 1 && before.lapTime === lastLapTime) {
    return history;
  }
  return [...history.slice(0, -1), { ...latest, lapTime: lastLapTime }];
}

// ── presentation ─────────────────────────────────────────────────────────────

/** How a lap's burn sits against the reference, at the table's precision. */
export type BurnTone = "lower" | "higher" | "even";

export interface FuelHistoryRow extends FuelLap {
  /** `used` minus the reference, rounded to the table's 0.01 L; else `null`. */
  delta: number | null;
  tone: BurnTone | null;
}

/**
 * The rows to draw, newest first — the lap just finished sits under the
 * column labels, where a glance lands — each with its burn against
 * `reference` (the strategy's per-lap figure, so a row reads as "this lap
 * against the number the plans assume").
 */
export function fuelHistoryRows(
  history: readonly FuelLap[],
  reference: number | null,
): FuelHistoryRow[] {
  const rows: FuelHistoryRow[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const lap = history[i];
    if (lap.used == null || reference == null) {
      rows.push({ ...lap, delta: null, tone: null });
      continue;
    }
    // Rounded first, so the tone always agrees with the printed figure: a lap
    // 0.004 L over never shows `0.00` in red.
    const delta = Math.round((lap.used - reference) * 100) / 100 || 0;
    const tone: BurnTone = delta < 0 ? "lower" : delta > 0 ? "higher" : "even";
    rows.push({ ...lap, delta, tone });
  }
  return rows;
}
