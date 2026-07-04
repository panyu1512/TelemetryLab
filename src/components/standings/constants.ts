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

/** Every column in the timing table, in render order. */
export type StandingsColumnId =
  | "change"
  | "pos"
  | "num"
  | "driver"
  | "license"
  | "irating"
  | "gap"
  | "interval"
  | "last"
  | "best"
  | "tire"
  | "sectors"
  | "state";

interface ColumnDef {
  id: StandingsColumnId;
  /** Sticky-header label. */
  label: string;
  /** Longer name for the config toggles. */
  name: string;
  /** CSS grid width (per column; for `sectors`, per sector). */
  width: string;
  /** Approx px width, used to compute the min table width. */
  px: number;
  /** Header/label text alignment. */
  align: "left" | "center" | "right";
  /** Structural columns that can't be turned off. */
  always?: boolean;
}

/**
 * The canonical, ordered column model. The sticky header, every row and the
 * config toggles all derive from this list, so they stay in lockstep. `pos`,
 * `driver` and `state` are always shown; the rest are user-configurable.
 */
export const STANDINGS_COLUMNS: readonly ColumnDef[] = [
  { id: "change", label: "Δ", name: "Position change", width: "1.6rem", px: 26, align: "center" },
  { id: "pos", label: "Pos", name: "Position", width: "2rem", px: 32, align: "center", always: true },
  { id: "num", label: "#", name: "Car number", width: "2.4rem", px: 38, align: "center" },
  { id: "driver", label: "Driver", name: "Driver", width: "minmax(9rem, 1fr)", px: 144, align: "left", always: true },
  { id: "license", label: "Lic", name: "License / SR", width: "3.2rem", px: 51, align: "center" },
  { id: "irating", label: "iR", name: "iRating", width: "4.4rem", px: 70, align: "right" },
  { id: "gap", label: "Gap", name: "Gap to leader", width: "3.4rem", px: 54, align: "right" },
  { id: "interval", label: "Int", name: "Interval", width: "3.4rem", px: 54, align: "right" },
  { id: "last", label: "Last", name: "Last lap", width: "4.6rem", px: 74, align: "right" },
  { id: "best", label: "Best", name: "Best lap", width: "4.6rem", px: 74, align: "right" },
  { id: "tire", label: "Tyre", name: "Tyre compound", width: "3.2rem", px: 51, align: "center" },
  { id: "sectors", label: "S", name: "Sector deltas", width: "2.8rem", px: 46, align: "center" },
  { id: "state", label: "", name: "Pit / off-track", width: "2.2rem", px: 35, align: "center", always: true },
];

/** Columns the user can toggle (everything not marked `always`). */
export const CONFIGURABLE_COLUMNS = STANDINGS_COLUMNS.filter((c) => !c.always);

export type ColumnVisibility = (id: StandingsColumnId) => boolean;

/** Whether a column should render, honouring `always`. */
function shows(col: ColumnDef, isVisible: ColumnVisibility): boolean {
  return col.always === true || isVisible(col.id);
}

/** The visible columns in order (expanding `sectors` to N entries). */
export function visibleColumns(
  sectorCount: number,
  isVisible: ColumnVisibility
): { key: string; col: ColumnDef; sectorIndex?: number }[] {
  const out: { key: string; col: ColumnDef; sectorIndex?: number }[] = [];
  for (const col of STANDINGS_COLUMNS) {
    if (!shows(col, isVisible)) continue;
    if (col.id === "sectors") {
      for (let i = 0; i < sectorCount; i++) {
        out.push({ key: `s${i}`, col, sectorIndex: i });
      }
    } else {
      out.push({ key: col.id, col });
    }
  }
  return out;
}

/** Build the CSS grid-template-columns string for the visible columns. */
export function gridTemplate(
  sectorCount: number,
  isVisible: ColumnVisibility
): string {
  return visibleColumns(sectorCount, isVisible)
    .map((c) => c.col.width)
    .join(" ");
}

/** Minimum table width so columns never crush; below this it scrolls-x. */
export function tableMinWidth(
  sectorCount: number,
  isVisible: ColumnVisibility
): number {
  const px = visibleColumns(sectorCount, isVisible).reduce(
    (sum, c) => sum + c.col.px,
    0
  );
  return px + 16;
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
