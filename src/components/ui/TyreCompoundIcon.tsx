import type { TyreKind } from "../../lib/tyreCompound";

/**
 * The compound badge: a ring with the compound's letter in it — `D` in white
 * for a dry, `W` in `--color-tyre-wet` blue for a wet.
 *
 * This is the convention a driver already reads off every TV graphic and the
 * sim's own black box: a coloured ring, one letter, blue for rain. It replaced
 * a side-on tyre glyph whose slick and wet differed only by the shape in the
 * hub, which at row size meant telling a dot from a drop. Here the difference
 * is carried twice — by the letter *and* by the colour — so a field going to
 * wets reads as a column turning blue before a single letter is read.
 *
 * Ring and letter share one colour, set here rather than inherited from the
 * row: the badge means the same thing on every row, lapped traffic included.
 */

/* Dry is the ordinary case and takes the label grey; wet is the one that
 * means something, and keeps its blue. */
const COLOR: Record<TyreKind, string> = {
  dry: "var(--color-muted)",
  wet: "var(--color-tyre-wet)",
};

const LETTER: Record<TyreKind, string> = { dry: "D", wet: "W" };

export interface TyreCompoundIconProps {
  kind: TyreKind;
  /** CSS length for the (square) box. */
  size: string;
  /** Accessible name; defaults to "Dry tyre" / "Wet tyre". */
  label?: string;
}

export function TyreCompoundIcon({ kind, size, label }: TyreCompoundIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      role="img"
      aria-label={label ?? (kind === "wet" ? "Wet tyre" : "Dry tyre")}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: "block",
        color: COLOR[kind],
      }}
    >
      {/* A clean ring and a letter set as large as the ring allows — large
          enough not to read as a clock face at the table's smaller scales,
          light enough to sit with the figures beside it. */}
      <circle
        cx="8"
        cy="8"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <text
        x="8"
        y="8.4"
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        fontFamily="var(--font-timing)"
        fontSize="8.4"
        fontWeight="600"
      >
        {LETTER[kind]}
      </text>
    </svg>
  );
}
