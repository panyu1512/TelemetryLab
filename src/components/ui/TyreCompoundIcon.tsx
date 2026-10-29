import { TYRE_LETTER, TYRE_NAME, type TyreCompound } from "../../lib/tyreCompound";

/**
 * The compound badge, drawn the way a broadcast draws it: a dark tyre with a
 * coloured band round its sidewall and the compound's letter in the middle —
 * red `S` soft, yellow `M` medium, white `H` hard, green `I` inter, blue `W`
 * wet, and a grey `D` for a dry the sim names in no way we recognise.
 *
 * This is the convention a driver already reads off every TV graphic: the
 * colour says the compound before the letter is read, so a field going to
 * wets reads as a column turning blue. The letter carries it a second time
 * for anyone who does not tell red from green. The rubber disc is the ground
 * both sit on, so a yellow or white letter stays legible over live footage as
 * well as on the overlay's own paper.
 *
 * Band and letter share one colour, set here rather than inherited from the
 * row: the badge means the same thing on every row, lapped traffic included.
 */

/* The broadcast palette, each in its own fixed token (§ Theme table). A dry we
 * cannot name is the ordinary case and takes the label grey. */
const COLOR: Record<TyreCompound, string> = {
  soft: "var(--color-tyre-soft)",
  medium: "var(--color-tyre-medium)",
  hard: "var(--color-tyre-hard)",
  inter: "var(--color-tyre-inter)",
  wet: "var(--color-tyre-wet)",
  dry: "var(--color-muted)",
};

export interface TyreCompoundIconProps {
  compound: TyreCompound;
  /** CSS length for the (square) box. */
  size: string;
  /** Accessible name; defaults to "Soft tyre", "Wet tyre", … */
  label?: string;
}

export function TyreCompoundIcon({ compound, size, label }: TyreCompoundIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      role="img"
      aria-label={label ?? `${TYRE_NAME[compound]} tyre`}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: "block",
        color: COLOR[compound],
      }}
    >
      <circle cx="8" cy="8" r="8" fill="var(--color-tyre-rubber)" />
      {/* The sidewall band, broken at three and nine o'clock where a real
          tyre carries its lettering — the gaps are what make it read as a
          tyre rather than a ring. */}
      <path
        d="M2.174 5.88 A6.2 6.2 0 0 1 13.826 5.88 M13.826 10.12 A6.2 6.2 0 0 1 2.174 10.12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <text
        x="8"
        y="8.4"
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        fontFamily="var(--font-timing)"
        fontSize="8.4"
        fontWeight="700"
      >
        {TYRE_LETTER[compound]}
      </text>
    </svg>
  );
}
