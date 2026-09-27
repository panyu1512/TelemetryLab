/**
 * Shared geometry + column model for the timing tower — the Standings screen.
 *
 * Every length here is in the design canvas's own pixels (2026-09-27, "Timing
 * tower rediseñado"). The tower was drawn at 1440 wide and reviewed at that
 * size, so these numbers can be checked against it one for one; the table then
 * draws at whatever fraction of that its window allows (`lib/tableScale`),
 * never larger. At the widths people actually give a standings window the
 * rows come out close to the 32 px they used to be — the canvas and the old
 * table want nearly the same width per pixel of row — so what changed is the
 * proportions, not the size on screen.
 *
 * The column template is defined once and used by the label row and every
 * row, so they stay pixel-aligned whatever the sector count. Heights are fixed
 * because the field is laid out by absolute `translateY` offsets — that is what
 * makes animated position swaps and windowed rendering both cheap (see
 * `useStandingsLayout`).
 */

/** One row of the field. */
export const ROW_H = 44;
/** The race-control bar above the field. */
export const BAR_H = 48;
/** The header that opens each class card: chip, cars, SoF, best lap. */
export const CLASS_BAND_H = 48;
/** The optional column-label row under a class header. */
export const LABEL_ROW_H = 28;
/** Space between two class cards, and between the bar and the first one. */
export const CARD_GAP = 12;
/** A class card's edge. Inside the scaled box, like everything else. */
export const CARD_BORDER = 1;
/** Paper around the whole tower. */
export const SURFACE_PAD = 12;
/** A row's own inset from the card edge, left and right. */
export const ROW_PAD_X = 16;
/** Between two columns. */
export const COL_GAP = 10;
/** A hairline after every this many rows, to count the field in threes. */
export const DIVIDER_EVERY = 3;
/** The legend: three rows of 24 with 6 between them. */
export const LEGEND_H = 3 * 24 + 2 * 6;

/**
 * How far the tower may shrink before it scrolls sideways instead.
 *
 * The same backstop the old table had in absolute terms — half of its ~1030 px
 * natural width — re-expressed against the canvas's wider natural width, so a
 * window that could show the whole old table at its floor can still show the
 * whole tower.
 */
export const TOWER_MIN_SCALE = 0.35;

/** Every column in the timing table, in render order. */
export type StandingsColumnId =
  | "pos"
  | "change"
  | "num"
  | "country"
  | "driver"
  | "brand"
  | "license"
  | "irating"
  | "gap"
  | "interval"
  | "last"
  | "trend"
  | "best"
  | "tire"
  | "sectors";

interface ColumnDef {
  id: StandingsColumnId;
  /** Label-row text. */
  label: string;
  /** Longer name for the config toggles. */
  name: string;
  /**
   * Width in canvas px. For the flexible `driver` column this is a *target*,
   * not a floor: the column itself is `minmax(0, 1fr)` and can shrink to
   * nothing. The sum is the width the table wants, which is what it is scaled
   * against. For `sectors`, per sector.
   */
  px: number;
  /** Label and value alignment. Numbers are right-aligned so decimals line up. */
  align: "left" | "center" | "right";
  /**
   * Padding on the right of the label so it sits over the value, not over the
   * cell edge — the cells whose values sit in a padded chip.
   */
  labelInset?: number;
  /** Structural columns that can't be turned off. */
  always?: boolean;
}

/**
 * The canonical, ordered column model. The label row, every row and the
 * config toggles all derive from this list, so they stay in lockstep.
 *
 * **Every time column is the same width** — gap, interval, last, best and each
 * sector — so the eye tracks one rhythm across the timing half of the row, and
 * a value never has to be found in a column of a different size from its
 * neighbour's. 84 is what the widest of them (a last lap with its INV-free
 * `2:15.892` at 15 px, or a class-best chip) needs.
 *
 * There is no state column any more. A car's state — PIT, off track,
 * disconnected, the meatball, final lap — is a chip beside its name, and DSQ
 * takes over its position block: the state belongs to the driver, and the old
 * 35 px column spent a whole column's width on a glyph most rows never had.
 */
export const STANDINGS_COLUMNS: readonly ColumnDef[] = [
  { id: "pos", label: "Pos", name: "Position", px: 44, align: "center", always: true },
  { id: "change", label: "+/−", name: "Position change", px: 36, align: "right" },
  { id: "num", label: "#", name: "Car number", px: 32, align: "right" },
  { id: "country", label: "Nat", name: "Country flag", px: 28, align: "center" },
  // The name absorbs all slack and is the only column allowed to truncate
  // (`design.md` § Dense tabular overlays, rule 6).
  { id: "driver", label: "Driver", name: "Driver", px: 240, align: "left", always: true },
  { id: "brand", label: "Car", name: "Car brand", px: 48, align: "center" },
  { id: "license", label: "Lic", name: "License / SR", px: 56, align: "center" },
  { id: "irating", label: "iRating", name: "iRating", px: 72, align: "right" },
  { id: "gap", label: "Gap", name: "Gap", px: 84, align: "right", labelInset: 6 },
  { id: "interval", label: "Int", name: "Interval", px: 84, align: "right", labelInset: 6 },
  { id: "last", label: "Last", name: "Last lap", px: 84, align: "right" },
  { id: "trend", label: "Trend", name: "Pace trend (last 5 laps)", px: 52, align: "center" },
  { id: "best", label: "Best", name: "Best lap", px: 84, align: "right", labelInset: 6 },
  { id: "tire", label: "Tyre", name: "Tyre compound + laps", px: 60, align: "right" },
  { id: "sectors", label: "S", name: "Sector times", px: 84, align: "right", labelInset: 8 },
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
    .map((c) => (c.col.id === "driver" ? "minmax(0, 1fr)" : `${c.col.px}px`))
    .join(" ");
}

/**
 * The width the whole tower wants: every visible column, the gaps between
 * them, a row's inset, the card's edges and the paper around it. The window is
 * divided by this to get the scale.
 */
export function tableMinWidth(
  sectorCount: number,
  isVisible: ColumnVisibility
): number {
  const cols = visibleColumns(sectorCount, isVisible);
  const px = cols.reduce((sum, c) => sum + c.col.px, 0);
  return (
    px +
    Math.max(0, cols.length - 1) * COL_GAP +
    2 * ROW_PAD_X +
    2 * CARD_BORDER +
    2 * SURFACE_PAD
  );
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

// ── still shared with the Relative ───────────────────────────────────────────
//
// The Relative has not moved to the tower's look yet (`design.md` § Known
// follow-ups), and it borrows these two from the table it used to share a
// language with. They keep their old meaning there.

/**
 * The Relative's class-colour edge, held at its drawn size however far the
 * table scales down: dividing by the scale inside the scaled box keeps it at
 * its drawn width on screen.
 */
export const CLASS_EDGE_WIDTH = "calc(4px / var(--table-scale, 1))";

/**
 * Lap-status → the rule drawn under the Relative's last-lap cell. Statuses
 * with no entry get no rule, so an ordinary lap stays completely plain.
 */
export const LAP_UNDERLINE: Record<string, string | undefined> = {
  overall_best: "var(--color-sector-purple)",
  personal_best: "var(--color-accent)",
};
