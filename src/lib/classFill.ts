/**
 * The class colour's fill across the opening cells of a timing row.
 *
 * The class edge used to be the one carrier of class on a row: 4 px of solid
 * colour and nothing else. It now runs on into the row as a fill that fades out
 * by the end of the position cell, so the number read first sits on its class's
 * colour, and the edge reads as the hard start of a gradient rather than a
 * hairline that happened to match.
 *
 * A gradient rather than a block, for the reason the solid position block went
 * (`design.md` § Two colour systems, rule 2): a block of full-strength identity
 * colour in every row is the loudest thing on the surface. Faded, it is strong
 * only against the edge, and the position digits sit where it has thinned out.
 *
 * Fixed, not driven: the fill's reach is a column boundary, the same on every
 * row on every tick. Nothing that moves at 10 Hz sets its extent.
 */

/** One stop of the fill: `at` is a fraction of the reach, `alpha` its strength. */
interface FillStop {
  at: number;
  alpha: number;
}

/**
 * The fill's profile, from the class edge (0) to the end of its reach (1).
 *
 * Strong against the edge, under half strength by the time it reaches the
 * position digits, and gone at the end of the position cell. How strong it
 * may be is set by the digits, not by taste: white has to clear 4.5:1 on the
 * fill at the left edge of a two-digit position, on the lightest class colour
 * (lime), on the player's row — whose `primary` ground is the lighter of the
 * two. See the contrast test.
 */
export const CLASS_FILL_STOPS: readonly FillStop[] = [
  { at: 0, alpha: 0.75 },
  { at: 0.5, alpha: 0.32 },
  { at: 1, alpha: 0 },
];

/**
 * Strength of the fill at `t`, a fraction of its reach. Linear between stops,
 * as the browser draws it; clamped outside 0–1.
 */
export function classFillStrength(t: number): number {
  const stops = CLASS_FILL_STOPS;
  if (t <= stops[0].at) return stops[0].alpha;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (t <= b.at) {
      return a.alpha + ((t - a.at) / (b.at - a.at)) * (b.alpha - a.alpha);
    }
  }
  return stops[stops.length - 1].alpha;
}

/** `color` at `alpha` strength, as a CSS colour. Works on any CSS colour. */
function atStrength(color: string, alpha: number): string {
  if (alpha <= 0) return "transparent";
  const pct = Math.round(alpha * 1000) / 10;
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

/**
 * The fill as a CSS `background-image`, layered over the row's own ground.
 *
 * @param color The class's identity colour (`lib/classColors`).
 * @param reach CSS length from the row's padding edge to where the fill has
 *   faded out — the end of the position cell. A length rather than a
 *   percentage, so the fill stops at the same column boundary whatever the
 *   row's width.
 */
export function classFill(color: string, reach: string): string {
  const stops = CLASS_FILL_STOPS.map(
    (s) => `${atStrength(color, s.alpha)} calc(${reach} * ${s.at})`
  );
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

/**
 * The Relative's class badge: a dark chip cut into the fill, under white ink.
 * It sits where the fill is strongest, and a chip of solid class colour there
 * had no edge left to read by. The contrast test holds white on it above 6:1
 * over every ramp colour at full strength.
 */
export const CLASS_BADGE_GROUND = "rgb(0 0 0 / 0.55)";
