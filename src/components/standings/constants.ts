/**
 * Shared geometry + column model for the timing screen.
 *
 * The column template is defined once and used by both the sticky column header
 * and every row, so they stay pixel-aligned regardless of how many sectors the
 * track has. Row heights are fixed because the list is laid out by absolute
 * `translateY` offsets — that is what makes animated position swaps and
 * windowed virtualization both cheap (see `useStandingsLayout`).
 */

export const ROW_H = 30;
export const CLASS_HEADER_H = 34;
export const COL_HEADER_H = 28;

/** Fixed column widths (rem); the driver column is the flexible `1fr`. */
const FIXED = {
  change: "1.6rem",
  pos: "2rem",
  num: "2.4rem",
  driver: "minmax(9rem, 1fr)",
  license: "3.2rem",
  irating: "4.4rem",
  gap: "3.4rem",
  interval: "3.4rem",
  last: "4.6rem",
  best: "4.6rem",
  sector: "2.8rem",
  state: "2.2rem",
} as const;

/** Build the CSS grid-template-columns string for a given sector count. */
export function gridTemplate(sectorCount: number): string {
  const sectors = Array.from({ length: sectorCount }, () => FIXED.sector).join(
    " "
  );
  return [
    FIXED.change,
    FIXED.pos,
    FIXED.num,
    FIXED.driver,
    FIXED.license,
    FIXED.irating,
    FIXED.gap,
    FIXED.interval,
    FIXED.last,
    FIXED.best,
    sectors,
    FIXED.state,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Minimum table width so columns never crush; below this it scrolls-x. */
export function tableMinWidth(sectorCount: number): number {
  return 560 + sectorCount * 46;
}

/** Sector-status → CSS color token. Drives purple/green/yellow/red. */
export const SECTOR_COLOR: Record<string, string> = {
  overall_best: "var(--color-sector-purple)",
  personal_best: "var(--color-accent)",
  slower: "var(--color-warning)",
  much_slower: "var(--color-danger)",
  none: "var(--color-muted)",
};

/** Lap-status → highlight color for the last-lap cell. */
export const LAP_COLOR: Record<string, string> = {
  overall_best: "var(--color-sector-purple)",
  personal_best: "var(--color-accent)",
  normal: "var(--color-text)",
  none: "var(--color-muted)",
};
