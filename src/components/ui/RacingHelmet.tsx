/**
 * A racing helmet in profile, used where a count of cars needs a label.
 *
 * It replaces the word `CARS` in the class band. The word was the odd one out
 * there: `SoF` and `Best` name *measures* of a class, where the car count names
 * the class's **population** — the thing the other two are measured over. A
 * glyph draws that distinction where three interchangeable mono labels flattened
 * it, and it does so in the field's own vernacular rather than in a generic
 * pictogram, which is the same argument `SteeringWheel` makes against a
 * deflection bar: a helmet does not need translating back into what it counts.
 *
 * Two things the artwork decided:
 *
 * - **The viewBox is `0 38 512 436`, not the `0 0 512 512` the file shipped
 *   with.** The ink spans the full width of the square box but is inset 38 units
 *   top and bottom, so a square box pads the glyph vertically and not at all
 *   horizontally. Sized by height in a row of baseline-aligned text, that padding
 *   is a phantom descender: it lifts the helmet off the digits' baseline by ~9 %
 *   of its own height and leaves it floating. Cropping to the ink puts the
 *   helmet's chin *on* the baseline, where the digits beside it sit.
 * - **Both subpaths, no `fill-rule`.** The outer shell and the inner counter
 *   wind opposite ways, so the default `nonzero` cuts the visor and the shell's
 *   interior exactly as `evenodd` would. Naming a rule here would imply the two
 *   differ, and the next person would have to check whether it mattered.
 */

/** The outline, verbatim as supplied — outer shell, then the counter. */
const HELMET_PATH =
  "M443.754,100.589c-42.488-38.948-101.656-62.589-168.532-62.572c-14.333,0-29.029,1.084-43.994,3.345h0.012c-58.544,8.685-105.082,33.862-138.727,71.035C58.8,149.528,34.46,197.852,23.824,252.531L5.366,337.568L0,473.983h438.046l5.247-6.365c15.622-19.077,29.682-61.881,41.482-91.725c11.705-29.827,20.852-62.18,25.032-91.384c1.476-10.298,2.193-20.502,2.193-30.552C512.034,193.927,486.26,139.477,443.754,100.589z M475.219,279.569c-3.652,25.68-12.14,56.036-22.968,83.534c-9.299,23.769-20.552,61.258-31.072,75.932H36.533l2.474-71.428l177.495-22.78c0,0,61.416-10.238,63.122-55.431c1.152-30.698-27.656-38.632-71.654-40.944l-145.488-8.652c10.524-41.643,31.329-76.888,55.896-103.908c28.368-31.108,66.317-52.129,118.05-59.979l8.639-1.296l-8.626,1.296c13.258-1.996,26.205-2.952,38.78-2.952c58.661,0.018,109.143,20.613,144.925,53.392c35.766,32.847,56.873,77.63,56.907,127.601C477.054,262.343,476.456,270.892,475.219,279.569z";

/**
 * Width of the cropped viewBox over its height.
 *
 * Written out rather than left to `width: auto`. An SVG with a viewBox and one
 * axis set does resolve the other from the aspect ratio, but the result is a
 * used value the flex layout resolves a step later — and this glyph sits in a
 * `shrink-0` row whose fields drop by measured width. A number here keeps the
 * helmet's footprint knowable at layout time on any engine, which matters more
 * than saving the constant, given the app ships against two different webviews.
 */
const ASPECT = 512 / 436;

export interface RacingHelmetProps {
  /**
   * CSS length for the glyph's **height**; width follows from {@link ASPECT}.
   *
   * Height rather than a square `size` because the helmet is landscape, and
   * because what it has to agree with is the height of the digits it labels.
   */
  size: string;
  /**
   * What the glyph says, for anyone not looking at it.
   *
   * Required, with no default. The helmet stands in for a word that used to be
   * on screen, so there is no reading of this component where the name is
   * optional — and the right name depends on the count beside it, which only
   * the call site knows.
   */
  label: string;
}

export function RacingHelmet({ size, label }: RacingHelmetProps) {
  return (
    <svg
      viewBox="0 38 512 436"
      role="img"
      aria-label={label}
      style={{
        height: size,
        width: `calc(${size} * ${ASPECT})`,
        flexShrink: 0,
        // Baseline alignment in the band works on the box's bottom edge, which
        // the cropped viewBox has already put on the helmet's chin. `block`
        // stops an inline box adding a line-height gap under it and undoing that.
        display: "block",
      }}
    >
      <path d={HELMET_PATH} fill="currentColor" />
    </svg>
  );
}
