/**
 * Pure derivations behind the timing screens' session strip
 * (`src/components/timing/SessionStrip.tsx`).
 *
 * Kept out of the component for the usual reason this codebase splits logic
 * out: the strip renders against a 60 Hz store and a 1 Hz one, so anything with
 * a rule in it should be testable without mounting React.
 */

import type { SessionInfo } from "../telemetry/types";
import { SessionKind, sessionKind } from "./sessionKind";

/* -------------------------------------------------------------------------- */
/*  Flags                                                                     */
/* -------------------------------------------------------------------------- */

export interface FlagTone {
  color: string;
  label: string;
}

/**
 * Active-flag → strip colour, in descending order of what the driver needs to
 * know *first*. iRacing's flag bitmask routinely has several bits set at once
 * (green + start_go, yellow + caution_waving), so this is an ordered list and
 * the first match wins rather than a plain map.
 *
 * These are the `design.md` § Theme status meanings, not a re-creation of the
 * marshal's flag colours: a black flag is `danger` because it is critical to
 * the driver, and drawing it in literal black on a black strip would be
 * unreadable anyway.
 */
const FLAG_TONE: readonly (readonly [flag: string, color: string, label: string])[] =
  [
    ["checkered", "var(--color-text)", "Chequered"],
    ["red", "var(--color-danger)", "Red flag"],
    ["disqualify", "var(--color-danger)", "Disqualified"],
    ["black", "var(--color-danger)", "Black flag"],
    ["repair", "var(--color-danger)", "Meatball — repairs required"],
    ["caution_waving", "var(--color-warning)", "Caution"],
    ["yellow_waving", "var(--color-warning)", "Yellow — waving"],
    ["caution", "var(--color-warning)", "Caution"],
    ["yellow", "var(--color-warning)", "Yellow"],
    ["debris", "var(--color-warning)", "Debris"],
    ["furled", "var(--color-warning)", "Furled black — warning"],
    ["blue", "var(--color-primary)", "Blue — faster car behind"],
    ["white", "var(--color-text)", "White — final lap"],
    ["one_lap_to_green", "var(--color-accent)", "One lap to green"],
    ["green", "var(--color-accent)", "Green"],
    ["green_held", "var(--color-accent)", "Green held"],
  ];

/** The most urgent active flag, or null when none of the decoded flags is one
 *  the strip shows (the mask's pit/start bits alone don't colour the strip). */
export function activeFlag(flags: readonly string[]): FlagTone | null {
  if (!flags.length) return null;
  const set = new Set(flags);
  for (const [flag, color, label] of FLAG_TONE) {
    if (set.has(flag)) return { color, label };
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/*  Session type                                                              */
/* -------------------------------------------------------------------------- */

/**
 * iRacing's `sessionType` is free text that varies by series ("Lone Qualify",
 * "Open Qualify", "Offline Testing"…). Collapse it to a four-character token so
 * the strip's leading field is a fixed width whatever series is loaded.
 *
 * Built on {@link sessionKind} so there is one definition of what counts as a
 * qualifying session — the strip's label and the timing screens' behaviour must
 * never disagree about which session the driver is in. Warmup is the one token
 * finer than the kinds: {@link SessionKind.Practice} covers it, but the strip
 * has room to say which practice it is.
 */
export function sessionTag(type: string): string {
  if (type.toLowerCase().includes("warm")) return "WARM";
  switch (sessionKind(type)) {
    case SessionKind.Race:
      return "RACE";
    case SessionKind.Qualify:
      return "QUAL";
    case SessionKind.Practice:
      return "PRAC";
    default:
      return type.slice(0, 4).toUpperCase() || "—";
  }
}

/* -------------------------------------------------------------------------- */
/*  Incidents                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Incident count → colour. iRacing does not publish the session's incident
 * limit over the SDK, so these are thresholds against the two limits nearly
 * every series uses (17x for a sprint, 25x+ for an enduro) rather than a
 * percentage of a known cap: amber once a limit is in sight, red once one is
 * close. Deliberately quiet below that — a driver two incidents in does not
 * need a coloured number.
 */
export function incidentColor(count: number): string {
  if (count >= 13) return "var(--color-danger)";
  if (count >= 8) return "var(--color-warning)";
  return "var(--color-text)";
}

/* -------------------------------------------------------------------------- */
/*  Race distance                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The strip's `LAP` value: laps completed over the race distance.
 *
 * A lapped race publishes its distance directly. A *timed* race does not have
 * one — so project it from the time left and the car's estimated lap, and mark
 * it `≈`. That projection is the whole point of the field in road racing, where
 * "am I on the last lap or the second to last" is a fuel and tyre decision, and
 * it is the one thing the reference overlays get right that a bare lap counter
 * does not.
 *
 * Returns just the lap number when there is no distance to show at all.
 */
export function raceDistance(
  session: Pick<
    SessionInfo,
    "isTimed" | "sessionTimeRemain" | "sessionLapsTotal" | "carEstLapTime"
  >,
  lap: number
): string {
  if (session.sessionLapsTotal != null) {
    return `${lap}/${session.sessionLapsTotal}`;
  }
  const est = session.carEstLapTime;
  if (session.isTimed && session.sessionTimeRemain != null && est && est > 0) {
    return `${lap}/≈${Math.round(lap + session.sessionTimeRemain / est)}`;
  }
  return lap > 0 ? String(lap) : "—";
}
