/**
 * Race control's flags on one car — the bridge's `carFlags`, from iRacing's
 * per-car `CarIdxSessionFlags` — as the marks a Standings row prints after
 * the driver's name (`design.md` § Dense tabular overlays, rule 19).
 *
 * Kept out of the component so the rules (which flags, in what order, what
 * a disqualification hides) are testable without mounting a row.
 */

/** The four flags race control flies at a single car. */
export type CarFlag = "disqualify" | "black" | "repair" | "furled";

export interface CarFlagMark {
  flag: CarFlag;
  /** Status ink (`design.md` § Theme) — never the marshal's own colours. */
  color: string;
  /** Tooltip and accessible name. */
  label: string;
}

/**
 * Most severe first, which is also the order the marks print in. The colours
 * are the session header's for the same flags (`lib/sessionStrip`): `danger`
 * for everything the car must act on, since a black flag drawn in black on
 * black paper is nothing, and `warning` for the slow-down, which is still a
 * warning rather than a penalty.
 */
const MARKS: readonly CarFlagMark[] = [
  { flag: "disqualify", color: "var(--color-danger)", label: "Disqualified" },
  {
    flag: "black",
    color: "var(--color-danger)",
    label: "Black flag — penalty to serve in the pits",
  },
  {
    flag: "repair",
    color: "var(--color-danger)",
    label: "Meatball — car damaged, must pit for repairs",
  },
  {
    flag: "furled",
    color: "var(--color-warning)",
    label: "Slow down — warning (furled black flag)",
  },
];

/**
 * The marks for a car's flags, most severe first. A disqualified car shows
 * that alone: it has no penalty left to serve and no race to repair the car
 * for. Unknown names are ignored, and an older bridge that sends no
 * `carFlags` reads as no flags.
 */
export function carFlagMarks(
  flags: readonly string[] | undefined
): CarFlagMark[] {
  if (!flags?.length) return [];
  const active = MARKS.filter((m) => flags.includes(m.flag));
  return active[0]?.flag === "disqualify" ? [active[0]] : active;
}
