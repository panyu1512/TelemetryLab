/**
 * The grounds of the licence / iRating pill on Standings (`A3.45 | 8895 ⌃14`).
 *
 * The pill used to be two flat tones: the licence colour taken to 42 % toward
 * black, and a 10 % white lift. Both segments now read as one lit object
 * rather than two painted rectangles, without spending any of the contrast the
 * digits on them need:
 *
 * - **the licence segment** is a diagonal gradient in the licence's own colour
 *   — brighter top-left, deeper bottom-right — and every stop stays dark
 *   enough that white clears 4.5:1 on all of iRacing's licence colours
 *   (see the test; C's yellow is the closest call);
 * - **the iRating segment** is a glass lift, lighter at the top, and its
 *   projected change is graded by a **rule** along the segment's foot that
 *   fades in toward the number — green for a gain, red for a loss. A rule, not
 *   a tint, for the reason the last-lap cell is ruled (`design.md` § Dense
 *   tabular overlays, rule 10): a status-coloured ground under status-coloured
 *   ink costs that ink its contrast, and a rule costs nothing.
 *
 * Both take {@link PILL_SHEEN}, a one-pixel highlight along the top edge.
 */

/** How much of the licence colour, toward black, at the gradient's two ends. */
export const LICENCE_MIX_LIGHT = 52;
export const LICENCE_MIX_DEEP = 30;

/** `color` taken toward black, keeping `pct` % of it (OKLab, as CSS mixes). */
function towardBlack(color: string, pct: number): string {
  return `color-mix(in oklab, ${color} ${pct}%, black)`;
}

/** The licence segment's ground: its own colour, lit from the top left. */
export function licenceGround(color: string): string {
  return `linear-gradient(135deg, ${towardBlack(color, LICENCE_MIX_LIGHT)}, ${towardBlack(color, LICENCE_MIX_DEEP)})`;
}

/** Thickness of the change rule along the iRating segment's foot, in px. */
export const CHANGE_RULE_PX = 2;

/**
 * The iRating segment's ground as CSS `background` layers: the change rule (if
 * there is a change) over a glass lift.
 */
export function ratingGround(change: number): string {
  const lift =
    "linear-gradient(180deg, rgb(255 255 255 / 0.15), rgb(255 255 255 / 0.06))";
  if (!change) return lift;
  const ink = change > 0 ? "var(--color-accent)" : "var(--color-danger)";
  const rule = `linear-gradient(90deg, transparent 30%, ${ink}) bottom / 100% ${CHANGE_RULE_PX}px no-repeat`;
  return `${rule}, ${lift}`;
}

/** A one-pixel highlight along the pill's top edge, inside it. */
export const PILL_SHEEN = "inset 0 1px 0 rgb(255 255 255 / 0.16)";
