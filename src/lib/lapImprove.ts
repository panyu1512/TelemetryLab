/**
 * The flash a qualifying row takes when its driver improves their best lap.
 *
 * On a qualifying board the event is the lap, not the pass: a car's place only
 * changes *because* it went faster, and a driver who improves without moving
 * up has still done the one thing the session is for. The position flash
 * (`lib/positionFlash`) already says when a place changed; this says when a
 * time did, and the two can fire together — a lap that also gains places
 * sweeps the row and flags the position.
 *
 * The grade is the lap table's own: `overall` when the new lap is the fastest
 * in the field (sector purple), otherwise `personal` (accent).
 */

import { isLapTime } from "./lapTimeOrder";

export type LapImproveGrade = "personal" | "overall";

/** One improvement, with an id that is new each time so a second improvement
 *  inside the hold restarts the sweep instead of inheriting the first. */
export interface LapImprove {
  grade: LapImproveGrade;
  id: number;
}

/** How long the improved row stays lit, in ms. */
export const LAP_IMPROVE_MS = 2400;

/**
 * Whether a best lap went from `before` to a faster `after`.
 *
 * A first lap — nothing before, a time after — is not an improvement: on a
 * qualifying board that car was not on the board until now, and its arrival is
 * its own effect. Either side unset, or a time that got slower (a reset, a lap
 * invalidated by the sim), is nothing to flash.
 */
export function lapImproved(
  before: number | null | undefined,
  after: number | null | undefined,
): boolean {
  if (!isLapTime(before) || !isLapTime(after)) return false;
  return after < before;
}
