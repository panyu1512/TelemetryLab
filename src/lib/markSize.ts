/**
 * Optical sizing for the manufacturer marks on Standings and Relative.
 *
 * Every mark's viewBox is cropped to its own ink, and they used to be drawn at
 * one *height* with only a width cap. That made the wide marks the loudest
 * thing in the column: at 21 px tall, McLaren's and Aston Martin's took a
 * 60 × 21 box and Audi's, Ford's and Chevrolet's 52 × 21 — three to four times
 * the area of Ferrari's 15 × 21 — so a row's size said more about the shape of
 * a logo than about anything in the race.
 *
 * Marks up to {@link FULL_HEIGHT_ASPECT} wide-to-tall keep the full height;
 * anything wider is drawn at the area a {@link FULL_HEIGHT_ASPECT} mark has at
 * that height, so a wordmark is wide and short and a badge is square, and both
 * weigh about the same on the row. Tall, narrow marks (a crest, a prancing
 * horse) cannot grow past the row's height, so they stay a little lighter —
 * the row height is the one hard limit.
 */

/**
 * The widest aspect ratio (width ÷ height) drawn at full height. A touch over
 * square, so the many roughly-square badges (BMW, Mercedes, Mazda, Nissan,
 * Honda, Toyota at 1.45 just over it) keep the size they were tuned at, and
 * only the genuinely wide marks are brought down.
 */
export const FULL_HEIGHT_ASPECT = 1.3;

/**
 * The height to draw a mark at, in the same unit as `boxHeight`.
 *
 * @param boxHeight The full height the row allows a mark.
 * @param aspect The mark's width ÷ height, from its viewBox. Anything that is
 *   not a positive finite number is treated as square.
 */
export function markHeight(boxHeight: number, aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= FULL_HEIGHT_ASPECT) return boxHeight;
  return boxHeight * Math.sqrt(FULL_HEIGHT_ASPECT / aspect);
}

/**
 * Width ÷ height of an SVG `viewBox` string (`"minX minY width height"`), or
 * 1 when it cannot be read.
 */
export function viewBoxAspect(viewBox: string | undefined | null): number {
  const parts = String(viewBox ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length !== 4) return 1;
  const [, , w, h] = parts;
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? w / h : 1;
}
