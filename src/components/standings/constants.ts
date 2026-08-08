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

/**
 * Height of the column-label line printed *inside* the class leader's row.
 *
 * There is deliberately no persistent column-header band: on a six-row Relative
 * a 28 px band was over 13 % of the overlay spent on labels a returning user
 * stopped reading in their first session (`design.md` § Dense tabular overlays,
 * rule 3). The labels instead live in the top slice of a row that has to exist
 * anyway, so they cost no height at all.
 */
export const COL_LABEL_H = 9;

/**
 * Vertical gap between class groups, in place of a labelled band. A gap reads
 * pre-attentively, costs a third of what a band cost, and needs nothing
 * clickable (rule 2).
 */
export const CLASS_GAP = 10;

/**
 * Per-class-group background tones, as `[base, zebra]` utility pairs, indexed by
 * the group's position in the field.
 *
 * This is the "tone shift" half of rule 2: consecutive class groups sit at
 * slightly different lightness, so a class boundary reads as a change of ground
 * rather than needing a label. Zebra tint is the only banding the rules allow,
 * so the shift rides on it instead of introducing a new device.
 */
export const GROUP_TONE: readonly (readonly [base: string, zebra: string])[] = [
  ["", "bg-surface-2/40"],
  ["bg-surface-2/15", "bg-surface-2/55"],
];

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
  /**
   * Approx px width, used to compute the min table width.
   *
   * For the flexible `driver` column this is a *target*, not a floor: the
   * column itself can shrink to nothing, but a table narrower than the sum of
   * these drops an optional column instead of crushing the name (rule 6).
   */
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
  // `minmax(0, 1fr)`, not `minmax(8rem, 1fr)`: the name absorbs all slack and is
  // the only column allowed to truncate. An 8rem floor made the grid overflow
  // its container instead, which is how fixed columns ended up holding empty
  // space while `Francois Sieg…` clipped (rule 6).
  { id: "driver", label: "Driver", name: "Driver", width: "minmax(0, 1fr)", px: 128, align: "left", always: true },
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
