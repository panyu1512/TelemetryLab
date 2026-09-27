/**
 * Geometry for the tower's pace sparkline: a car's last five laps, drawn next
 * to its last lap time.
 *
 * Two decisions are load-bearing, and both are about making rows comparable:
 *
 * - **A fixed scale, not a fitted one.** Every row maps the same window of
 *   seconds onto the same height — its own best lap at the baseline, two
 *   seconds slower at the top. Fitting each line to its own min and max would
 *   draw a car varying by a tenth exactly as wildly as one varying by two
 *   seconds, which is the opposite of what a glance down the column should say.
 * - **The latest lap is always the right-hand end.** With fewer than five laps
 *   recorded (the bridge has only just connected, or the car has only just
 *   started) the line is short and hangs off the right, so "now" is always in
 *   the same place.
 *
 * Up is slower: the line plots lap *time*, and the dotted baseline is the car's
 * own best, so a lap above it cost time.
 */

import { lapTime } from "./format";

export const TREND_WIDTH = 52;
export const TREND_HEIGHT = 18;
/** How many laps the line holds. */
export const TREND_LAPS = 5;

/** Seconds below the car's best the scale reaches (a new best lands here). */
const FLOOR_S = -0.3;
/** Seconds above the car's best that reach the top of the cell. */
const CEILING_S = 2.0;
const TOP = 3;
const BOTTOM = 15;
/** x of each of the five slots, left to right. */
const SLOTS = [3, 14.5, 26, 37.5, 49];

export interface TrendGeometry {
  /** SVG `points` for the polyline, oldest lap first. */
  points: string;
  /** y of the dotted baseline: the car's best lap. */
  baselineY: number;
  /** Where the latest lap sits, for the end dot. */
  last: { x: number; y: number };
  /** The laps read out, for the screen reader. */
  label: string;
}

function y(offset: number): number {
  const c = Math.max(FLOOR_S, Math.min(CEILING_S, offset));
  const frac = (c - FLOOR_S) / (CEILING_S - FLOOR_S);
  return Math.round((BOTTOM - frac * (BOTTOM - TOP)) * 10) / 10;
}

/**
 * The sparkline for `laps` (oldest first), measured against `best`. Falls back
 * to the quickest lap in the list when there is no best. Null when there is
 * nothing to draw.
 */
export function lapTrend(
  laps: readonly number[] | undefined,
  best: number | null | undefined,
): TrendGeometry | null {
  const valid = (laps ?? []).filter((t) => Number.isFinite(t) && t > 0).slice(-TREND_LAPS);
  if (valid.length === 0) return null;
  const ref = best != null && best > 0 ? best : Math.min(...valid);
  const offset = SLOTS.length - valid.length;
  const pts = valid.map((t, i) => ({ x: SLOTS[offset + i], y: y(t - ref) }));
  const last = pts[pts.length - 1];
  return {
    points: pts.map((p) => `${p.x},${p.y}`).join(" "),
    baselineY: y(0),
    last,
    label: `Last ${valid.length} ${valid.length === 1 ? "lap" : "laps"}: ${valid.map(lapTime).join(", ")}`,
  };
}
