/**
 * The timing tower's palette — the Standings screen in the look of the design
 * canvas of 2026-09-27 ("Timing tower rediseñado").
 *
 * The tower carries its own colours rather than the runtime theme's, and the
 * choice is deliberate: the canvas was drawn, reviewed and contrast-checked as
 * one fixed palette, and letting four themes re-tint it would put back exactly
 * the variations it was measured without. The themes still govern the manager,
 * the Relative and the widgets (`design.md` § The timing tower).
 *
 * Everything that paints the tower reads from here, so the palette is one
 * object that a test can walk: `towerPalette.test.ts` measures every ink
 * against every ground it can land on, and fails below WCAG AA.
 *
 * Colours say one thing each, and several of them say something different from
 * the theme tokens elsewhere in the app — on the tower, blue is "gained places"
 * as well as "you", and orange is "lost places / slower". That follows the
 * canvas, which chose blue/orange over green/red so the most common pair of
 * statuses survives red-green colour blindness.
 */

import { contrastRatio } from "./contrast";

export const TOWER = {
  // ── paper ──────────────────────────────────────────────────────────────────
  /** Behind everything: the overlay's own ground. */
  paper: "#07090B",
  /** Class cards and the race-control bar. */
  surface: "#0E1115",
  border: "#1F252D",
  /** The optional column-label row under a class header. */
  labelRow: "#0A0C0F",
  /** Zebra: even rows (P1, P3…) sit one step up, odd rows one step down. */
  rowA: "#151A20",
  rowB: "#0D1014",
  /** The hairline after every third row. */
  divider: "#2E3641",

  // ── ink ────────────────────────────────────────────────────────────────────
  /** Names, the primary gap. */
  text: "#E8EAED",
  /** Secondary numbers: interval, laps, sector deltas. */
  text2: "#C3C9D2",
  /** Quiet numbers and labels: car number, iRating, micro-labels. */
  text3: "#9AA3AF",
  /** Greyed-out: live timing of a car in the pits, a disconnected or DSQ row. */
  dim: "#8A929E",
  chipBorder: "#2A313B",

  // ── you ────────────────────────────────────────────────────────────────────
  meBg: "#1A2230",
  meRing: "#3B82F6",

  // ── movement ───────────────────────────────────────────────────────────────
  up: "#60A5FA",
  down: "#FB923C",

  // ── grades ─────────────────────────────────────────────────────────────────
  /** Fastest in class — a lap, a sector, the class header's best. A fill. */
  classBest: "#6D28D9",
  onClassBest: "#FFFFFF",
  /** A last lap that beat the whole field, drawn as its underline. */
  sessionBestRule: "#A78BFA",
  personalBest: "#86EFAC",
  personalBestTint: "rgba(34,197,94,0.16)",
  personalBestRing: "rgba(134,239,172,0.35)",
  /** A sector well off the car's own best. */
  slower: "#FDBA74",

  // ── states ─────────────────────────────────────────────────────────────────
  pit: "#E8EAED",
  onPit: "#07090B",
  dsq: "#3A1D1D",
  onDsq: "#FCA5A5",
  /** Off track, the meatball: things a yellow flag is shown for. */
  cautionTint: "rgba(250,204,21,0.12)",
  caution: "#FDE68A",
  disconnectedTint: "rgba(154,163,175,0.16)",
  disconnected: "#C3C9D2",
  finalLapTint: "rgba(248,250,252,0.14)",
  finalLap: "#F8FAFC",

  // ── tyres ──────────────────────────────────────────────────────────────────
  soft: "#EF4444",
  medium: "#FACC15",
  hard: "#F1F5F9",
  inter: "#4ADE80",
  wet: "#3B82F6",
  otherTyre: "#9AA3AF",

  // ── race control (the bar above the field) ────────────────────────────────
  raceBadge: "#22C55E",
  onRaceBadge: "#06210F",
  yellowBar: "#FACC15",
  yellowBorder: "#EAB308",
  yellowLabel: "#4A3A00",
  yellowValue: "#1A1400",
  flagBadge: "#141004",
  onYellowBadge: "#FACC15",
  scStripeA: "#F59E0B",
  scStripeB: "#E58E00",
  scBorder: "#D97706",
  scLabel: "#3D2800",
  scValue: "#140C00",
  onScBadge: "#FBBF24",

  // ── ink on identity colour ─────────────────────────────────────────────────
  darkInk: "#07090B",
  lightInk: "#FFFFFF",
} as const;

export type TowerColor = keyof typeof TOWER;

/**
 * The ink to print on a class colour — the position chip, the class chip.
 *
 * Measured, never declared (`design.md` § The timing tower, rule 4): a class
 * colour is the user's to pick now, and a navy needs white ink where a lime
 * needs dark. Whichever of the two reads better wins. Anything unparseable (a
 * `color-mix()` from the sixth-class fallback) gets white, the safe side on
 * this paper.
 */
export function towerInk(fill: string): string {
  const dark = contrastRatio(fill, TOWER.darkInk);
  const light = contrastRatio(fill, TOWER.lightInk);
  if (dark == null || light == null) return TOWER.lightInk;
  return dark >= light ? TOWER.darkInk : TOWER.lightInk;
}

/** The safety-car bar's ground: slow diagonal stripes in two ambers. */
export const SAFETY_CAR_STRIPES = `repeating-linear-gradient(-45deg, ${TOWER.scStripeA} 0 14px, ${TOWER.scStripeB} 14px 28px)`;
