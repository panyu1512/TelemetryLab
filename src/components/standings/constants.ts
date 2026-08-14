/**
 * Shared geometry + column model for the timing screen.
 *
 * The column template is defined once and used by both the sticky column header
 * and every row, so they stay pixel-aligned regardless of how many sectors the
 * track has. Row heights are fixed because the list is laid out by absolute
 * `translateY` offsets — that is what makes animated position swaps and
 * windowed virtualization both cheap (see `useStandingsLayout`).
 */

/**
 * Row height. 32 rather than 30: this surface's type went up a step and to
 * semibold/bold across the board (it is read in peripheral vision at speed, and
 * the previous 11–12 px regular weight was tuned for a screen you look *at*).
 * Two more pixels is what keeps 13 px names and 12 px values from touching the
 * zebra band above and below them.
 */
export const ROW_H = 32;

/**
 * Height of the column-label line printed *inside* the class leader's row.
 *
 * There is deliberately no persistent column-header band: on a six-row Relative
 * a 28 px band was over 13 % of the overlay spent on labels a returning user
 * stopped reading in their first session (`design.md` § Dense tabular overlays,
 * rule 3). The labels instead live in the top slice of a row that has to exist
 * anyway, so they cost no height at all.
 */
export const COL_LABEL_H = 10;

/**
 * Vertical gap between class groups, in place of a labelled band. A gap reads
 * pre-attentively, costs a third of what a band cost, and needs nothing
 * clickable (rule 2).
 */
export const CLASS_GAP = 10;

/**
 * Height of the per-class band that opens each group.
 *
 * A band was banned outright by an earlier reading of rule 2 — a gap plus a
 * tone shift costs a third as much and separates just as well. What that
 * reading missed is that separation was never the only job: in a multi-class
 * field the band is also the only place the class's *own* numbers (its car
 * count, its strength of field, its fastest lap) can live at all, and those
 * have nowhere else to go — they are per-class, so the session strip cannot
 * hold them, and per-group, so no row can.
 *
 * 30 px, not the 34 the old class header cost: it carries a chip and three
 * micro-label pairs, which is a strip's geometry rather than a row's — but it
 * is a *heading*, and one set flush against the row under it reads as a first
 * row rather than as the thing that opens the group.
 */
export const CLASS_BAND_H = 30;

/**
 * Space between a class band and the first row of its group. Small, but it is
 * what separates "this heads the group" from "this is the group's first entry".
 */
export const BAND_GAP = 4;

/**
 * Per-class-group background tones, as `[base, zebra]` utility pairs, indexed by
 * the group's position in the field.
 *
 * This is the "tone shift" half of rule 2: consecutive class groups sit at
 * slightly different lightness, so a class boundary reads as a change of ground
 * rather than needing a label. Zebra tint is the only banding the rules allow,
 * so the shift rides on it instead of introducing a new device.
 *
 * Plain white alphas rather than `surface-2` tints: the table now paints on
 * near-black paper (`--color-timing-bg`), where a graphite tint reads as a
 * *colour* change and white simply reads as one step lighter. It also keeps the
 * banding identical across all four themes, which is what a banding device
 * carrying no meaning should do.
 */
export const GROUP_TONE: readonly (readonly [base: string, zebra: string])[] = [
  ["", "bg-white/[0.035]"],
  ["bg-white/[0.025]", "bg-white/[0.06]"],
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
   * column itself can shrink to nothing. The sum of these is the width the
   * table wants, which is what it is scaled against rather than what it sheds
   * columns to reach (rule 6, and `lib/tableScale`).
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
  { id: "change", label: "Δ", name: "Position change", width: "1.8rem", px: 29, align: "center" },
  { id: "pos", label: "Pos", name: "Position", width: "2.1rem", px: 34, align: "center", always: true },
  { id: "num", label: "#", name: "Car number", width: "2.5rem", px: 40, align: "center" },
  { id: "country", label: "Nat", name: "Country flag", width: "1.7rem", px: 27, align: "center" },
  // `minmax(0, 1fr)`, not `minmax(8rem, 1fr)`: the name absorbs all slack and is
  // the only column allowed to truncate. An 8rem floor made the grid overflow
  // its container instead, which is how fixed columns ended up holding empty
  // space while `Francois Sieg…` clipped (rule 6).
  { id: "driver", label: "Driver", name: "Driver", width: "minmax(0, 1fr)", px: 136, align: "left", always: true },
  { id: "brand", label: "Car", name: "Car brand", width: "2.75rem", px: 44, align: "center" },
  { id: "license", label: "Lic", name: "License / SR", width: "3.4rem", px: 54, align: "center" },
  { id: "irating", label: "iR", name: "iRating", width: "4.6rem", px: 74, align: "right" },
  { id: "gap", label: "Gap", name: "Gap to leader", width: "3.6rem", px: 58, align: "right" },
  { id: "interval", label: "Int", name: "Interval", width: "3.6rem", px: 58, align: "right" },
  { id: "last", label: "Last", name: "Last lap", width: "4.9rem", px: 78, align: "right" },
  { id: "best", label: "Best", name: "Best lap", width: "4.9rem", px: 78, align: "right" },
  { id: "tire", label: "Tyre", name: "Tyre compound", width: "3.4rem", px: 54, align: "center" },
  { id: "sectors", label: "S", name: "Sector deltas", width: "3rem", px: 48, align: "center" },
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

/**
 * Where the first column ends, measured from the row's outer edge — the extent
 * of the class-colour fill behind a Standings row.
 *
 * Built from the same column model the grid is, so the fill lands on the column
 * boundary rather than near it. Three parts, in the order the row lays them
 * out: the class edge itself, the row's `px-1`, then the first visible column's
 * own width. The edge term carries the table scale for the reason
 * {@link CLASS_EDGE_WIDTH} does — it is the one length on this surface that
 * does not shrink, so the fill has to add back what the border kept.
 *
 * Which column is first depends on what is switched on: position change when
 * the user has it, position otherwise. Both are narrow, which is the point —
 * the fill is meant to sit under the row's leading number and stop.
 */
export function firstColumnStop(
  sectorCount: number,
  isVisible: ColumnVisibility
): string {
  const first = visibleColumns(sectorCount, isVisible)[0];
  if (!first) return "0px";
  return `calc(${CLASS_EDGE_WIDTH} + 0.25rem + ${first.col.width})`;
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
 * Columns that only mean something when the field is racing a common distance.
 *
 * `gap` and `interval` are measured to the car in front on the road; in a
 * practice session that car may be on an out-lap, in the pits, or eight laps
 * apart from you on the timesheet, and the number is noise dressed as timing.
 * `change` is worse than noise: it counts positions gained against the *race*
 * order the bridge tracks, so in a lap-time table — which this app ranks itself
 * — it would report movement against an order that is not on screen.
 */
const RACE_ONLY_COLUMNS: readonly StandingsColumnId[] = [
  "gap",
  "interval",
  "change",
];

/**
 * Columns a lap-time session cannot do without, whatever the user turned off.
 *
 * `best` is the sort key there — it is what put the rows in the order they are
 * in, which makes it structural in exactly the sense `pos` and `driver` are.
 * A table ranked by a column you cannot see is a table in no order at all.
 */
const LAP_TIME_COLUMNS: readonly StandingsColumnId[] = ["best"];

/**
 * The 3 px class-colour edge, held at its drawn size however far the table
 * scales down.
 *
 * It went from 2 px to 3 px because on near-black paper a 2 px hairline of an
 * arbitrary hue was the first thing to disappear in peripheral vision, which is
 * where this surface is read. A uniform scale takes it straight back under
 * that: at 0.6 a 3 px border draws at 1.8 px, thinner than the width already
 * rejected. Dividing by the scale inside the scaled box holds it at 3 px on
 * screen — the one measurement on this surface that means the same thing at
 * every size, because what it carries is presence rather than quantity.
 */
export const CLASS_EDGE_WIDTH = "calc(3px / var(--table-scale, 1))";

/**
 * Narrow the user's chosen columns to the ones that tell the truth in this
 * session: outside a race, the race-only columns go and the ranking column
 * stays.
 *
 * This is the only thing that hides a column now. It is about meaning, not
 * about room: the window decides how large the table is drawn, never what is
 * in it.
 */
export function scopeColumnsToSession(
  isVisible: ColumnVisibility,
  ranksByLapTime: boolean,
): ColumnVisibility {
  if (!ranksByLapTime) return isVisible;
  return (id) => {
    if (RACE_ONLY_COLUMNS.includes(id)) return false;
    if (LAP_TIME_COLUMNS.includes(id)) return true;
    return isVisible(id);
  };
}

/*
 * There is deliberately no responsive column-dropping here any more.
 *
 * A `fitColumns` used to shed columns down a priority list as the overlay
 * narrowed — sectors, then position change, tyre, licence, iRating, and on —
 * so the type could stay at full size. It meant resizing the overlay silently
 * changed what it showed, with nothing on screen to say a column had been
 * dropped rather than never sent. The surface now scales instead, whole and
 * with every column intact; see `lib/tableScale`.
 */

/** Sector-status → CSS color token. Drives purple/green/yellow/red. */
export const SECTOR_COLOR: Record<string, string> = {
  overall_best: "var(--color-sector-purple)",
  personal_best: "var(--color-accent)",
  slower: "var(--color-warning)",
  much_slower: "var(--color-danger)",
  none: "var(--color-faint)",
};

/** Lap-status → ink for the last-lap cell. */
export const LAP_COLOR: Record<string, string> = {
  overall_best: "var(--color-sector-purple)",
  // A personal best keeps white ink and takes its grade from the rule below.
  // The last lap is the number a driver actually compares against the car
  // ahead; recolouring the digits grades it at the cost of reading it.
  personal_best: "var(--color-text)",
  normal: "var(--color-text)",
  none: "var(--color-faint)",
};

/**
 * Lap-status → the rule drawn under the last-lap cell. Statuses with no entry
 * get no rule, so an ordinary lap stays completely plain.
 */
export const LAP_UNDERLINE: Record<string, string | undefined> = {
  overall_best: "var(--color-sector-purple)",
  personal_best: "var(--color-accent)",
};
