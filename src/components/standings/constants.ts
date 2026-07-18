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
  | "country"
  | "driver"
  | "brand"
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
  { id: "country", label: "Nat", name: "Country flag", width: "1.6rem", px: 26, align: "center" },
  { id: "driver", label: "Driver", name: "Driver", width: "minmax(8rem, 1fr)", px: 128, align: "left", always: true },
  { id: "brand", label: "Car", name: "Car brand", width: "1.7rem", px: 27, align: "center" },
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
  const cols = visibleColumns(sectorCount, isVisible);
  const px = cols.reduce((sum, c) => sum + c.col.px, 0);
  // + the 4px inter-column gaps (gap-x-1) and the row's horizontal padding.
  return px + Math.max(0, cols.length - 1) * 4 + 16;
}

/**
 * Auto-hide order (first dropped → last) when the window is too narrow for the
 * user's chosen columns. Position, driver, interval, last lap and status are
 * never auto-dropped — that set is the smallest useful timing table.
 */
const RESPONSIVE_DROP_ORDER: StandingsColumnId[] = [
  "sectors",
  "change",
  "tire",
  "license",
  "irating",
  "country",
  "num",
  "brand",
  "best",
  "gap",
];

/**
 * Narrow the visible-column set to what fits in `width` CSS pixels, dropping
 * optional columns in {@link RESPONSIVE_DROP_ORDER} until the minimum table
 * width fits (or there is nothing left to drop). The user's own hidden columns
 * stay hidden; a zero/unknown width leaves the set untouched.
 */
export function fitColumns(
  width: number,
  sectorCount: number,
  isVisible: ColumnVisibility
): ColumnVisibility {
  if (width <= 0) return isVisible;
  const dropped = new Set<StandingsColumnId>();
  const effective: ColumnVisibility = (id) => isVisible(id) && !dropped.has(id);
  for (const id of RESPONSIVE_DROP_ORDER) {
    if (tableMinWidth(sectorCount, effective) <= width) break;
    dropped.add(id);
  }
  return effective;
}

/** Sector-status → CSS color token. Drives purple/green/yellow/red. */
export const SECTOR_COLOR: Record<string, string> = {
  overall_best: "var(--color-sector-purple)",
  personal_best: "var(--color-accent)",
  slower: "var(--color-warning)",
  much_slower: "var(--color-danger)",
  none: "var(--color-faint)",
};

/** Lap-status → highlight color for the last-lap cell. */
export const LAP_COLOR: Record<string, string> = {
  overall_best: "var(--color-sector-purple)",
  personal_best: "var(--color-accent)",
  normal: "var(--color-text)",
  none: "var(--color-faint)",
};
