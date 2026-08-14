/**
 * What kind of session is running — and the one question the timing screens
 * actually ask of it: **is the field ranked by distance covered, or by lap
 * time?**
 *
 * Almost everything the Standings and Relative screens show is a race concept
 * dressed as a neutral number. Gap to leader, interval to the car ahead,
 * positions gained, "a lap down" — every one of them assumes the field is
 * running a common distance and that being in front means something. In
 * practice, qualifying or a test session none of that holds: cars join at
 * different times, run their own programmes, pit when they like, and the driver
 * two seconds ahead on the road may be eight laps apart from you on the
 * timesheet. The numbers keep rendering, and every one of them lies.
 *
 * So the screens branch on {@link ranksByLapTime} rather than on the session
 * name: a session where the field is ranked by best lap hides the columns that
 * would lie, ranks the table by lap time, and stops calling neighbours lapped
 * traffic.
 *
 * `sessionType` is free text that varies by series ("Lone Qualify", "Open
 * Qualify", "Offline Testing", "Heat 1"…), which is why this is substring
 * matching rather than a lookup. `lib/sessionStrip.sessionTag` builds the
 * strip's four-character display token on top of this.
 */

export const SessionKind = {
  /** Cars are racing a common distance; position and gaps mean what they say. */
  Race: "race",
  /** Ranked by best lap, one car at a time or all together. */
  Qualify: "qualify",
  /** Practice, warmup or offline testing — everyone on their own programme. */
  Practice: "practice",
  /**
   * A session name we do not recognise. A first-class member rather than a
   * null: an unknown session must keep the race behaviour, because that is the
   * one that shows the *most* information, and hiding columns on a guess is
   * worse than showing a number the driver can judge for themselves.
   */
  Unknown: "unknown",
} as const;

export type SessionKind = (typeof SessionKind)[keyof typeof SessionKind];

/** Classify iRacing's free-text `sessionType`. */
export function sessionKind(type: string | null | undefined): SessionKind {
  if (!type) return SessionKind.Unknown;
  const t = type.toLowerCase();
  // Qualifying first: "Lone Qualify" and "Open Qualify" carry no other keyword,
  // but checking it ahead of "race" means a series that ever ships a
  // "Qualifying Race" is read as the qualifier it is.
  if (t.includes("qual")) return SessionKind.Qualify;
  if (t.includes("race")) return SessionKind.Race;
  // Warmup sits here rather than with Race: nobody is racing in a warmup, the
  // field is not on a common distance, and iRacing publishes no grid order we
  // could show instead.
  if (t.includes("practice") || t.includes("test") || t.includes("warm")) {
    return SessionKind.Practice;
  }
  return SessionKind.Unknown;
}

/**
 * True when the field is ranked by best lap rather than by distance covered.
 *
 * This is the predicate the timing screens branch on — not the kind itself —
 * so that "which session is this" and "what does that change" stay separate
 * questions with one answer each.
 */
export function ranksByLapTime(kind: SessionKind): boolean {
  return kind === SessionKind.Qualify || kind === SessionKind.Practice;
}
