import type { TyreKind } from "../../lib/tyreCompound";

/**
 * A tyre seen side-on: a slick, or a wet with a water drop in the hub.
 *
 * Both glyphs share one silhouette, the sidewall ring, so the column reads as a
 * single thing ("the tyre") and only the hub changes. The difference is
 * carried by shape alone, in the row's own ink: blue is spoken for on this
 * surface (the player, lapped traffic), and a wet tyre is not a warning.
 *
 * Tread grooves were the obvious first idea and were rejected after rendering
 * them: notches around a ring at 11 px read as a gear, the settings icon. A
 * drop says "wet" without asking the reader to count cuts.
 */

/** Sidewall: an outer circle with the rim cut out (even-odd). */
const RING =
  "M0.5,8a7.5,7.5 0 1,0 15,0a7.5,7.5 0 1,0 -15,0Z" +
  "M3.2,8a4.8,4.8 0 1,0 9.6,0a4.8,4.8 0 1,0 -9.6,0Z";

/** Plain hub for a slick. */
const HUB = "M6,8a2,2 0 1,0 4,0a2,2 0 1,0 -4,0Z";

/** Water drop inside the rim for a wet, centred on the hub. */
const DROP =
  "M8,4.1C8,4.1 5.3,7.2 5.3,8.95A2.7,2.7 0 0 0 10.7,8.95C10.7,7.2 8,4.1 8,4.1Z";

export interface TyreCompoundIconProps {
  kind: TyreKind;
  /** CSS length for the (square) box. */
  size: string;
  /** Accessible name; defaults to "Slick tyre" / "Wet tyre". */
  label?: string;
}

export function TyreCompoundIcon({ kind, size, label }: TyreCompoundIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      role="img"
      aria-label={label ?? (kind === "wet" ? "Wet tyre" : "Slick tyre")}
      style={{ width: size, height: size, flexShrink: 0, display: "block" }}
    >
      <path
        d={RING + (kind === "wet" ? DROP : HUB)}
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
}
