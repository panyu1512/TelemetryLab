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
 * Two more pixels is what keeps 13 px names and 12 px values off the rows above
 * and below them.
 */
export const ROW_H = 32;

/**
 * Paper that used to show between one row's strip and the next.
 *
 * No longer drawn: on Standings and Relative the rows fill their slots edge
 * to edge, so a class's colour edge runs down its group unbroken (see
 * `design.md` § Dense tabular overlays, rule 9). It survives as the
 * allowance {@link STANDINGS_BRAND_H} is derived from, so the brand marks
 * keep the size they were tuned at. What follows is its original reasoning.
 *
 * Every row sits on its own `--color-timing-row` ground, inset this far from
 * the bottom of its {@link ROW_H} slot, so the field reads as a stack of
 * separate strips with the class edge opening each one. The slot keeps its
 * height — the layout still steps by `ROW_H` — so the gap costs the strip
 * three pixels of its own height rather than the table any of its rows.
 */
export const ROW_GAP = 3;

/**
 * The player's row: the one row marked in the accent, on Standings and
 * Relative alike (§ Two colour systems, rule 3) — "this is you" is selection,
 * and selection is what the one accent is for. A low tint and a 1 px inset
 * edge in the accent: enough to find at a glance, quiet enough that the
 * figures on it stay the loudest thing on the row. The edge keeps it findable
 * in the Graphite theme, whose accent is close to neutral.
 *
 * A literal class string, so Tailwind's scanner generates it.
 */
export const PLAYER_ROW_GROUND = "bg-primary/[0.13] ring-1 ring-inset ring-primary/55";

/**
 * A row's slot: one {@link ROW_H}, plus the label slice when the row carries
 * the column labels.
 *
 * The labels used to cost no height at all — the host row padded its own
 * content down by {@link COL_LABEL_H} instead — which squeezed that one row's
 * content into 19 px of a 29 px strip. A 24 px brand mark and a 20 px licence
 * pill do not fit in 19 px, so on the class leader's row they broke out of the
 * bottom of the strip. Labels are off by default, so the default layout pays
 * nothing for this; a driver who turns them on pays 10 px per group.
 */
export function rowSlotHeight(labelled: boolean): number {
  return ROW_H + (labelled ? COL_LABEL_H : 0);
}

/**
 * Brand-mark height on a Standings row: the strip less 4 px above and below.
 *
 * Every mark is cropped to its own ink (see `BRAND_ICON_H`), so the 24 px
 * default — set for a 32 px row on bare paper — filled the 29 px strip to
 * within 2.5 px of both edges, and the round badges (BMW, Volkswagen,
 * Mercedes) read as touching it. Derived from the geometry rather than set,
 * so it follows `ROW_H` and `ROW_GAP` if either moves.
 */
export const STANDINGS_BRAND_H = ROW_H - ROW_GAP - 8;

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
 * A band was banned outright by an earlier reading of rule 2 — a gap costs a
 * third as much and separates just as well. What that
 * reading missed is that separation was never the only job: in a multi-class
 * field the band is also the only place the class's *own* numbers (its car
 * count, its strength of field, its fastest lap) can live at all, and those
 * have nowhere else to go — they are per-class, so the session header cannot
 * hold them, and per-group, so no row can.
 *
 * 30 px, not the 34 the old class header cost: it carries a chip and three
 * micro-label pairs, which is a strip's geometry rather than a row's — but it
 * is a *heading*, and one set flush against the row under it reads as a first
 * row rather than as the thing that opens the group.
 */
export const CLASS_BAND_H = 30;

/**
 * Space between a class band and the first row of its group — clear, not
 * paper: the band and the rows are separate blocks (see `LayoutBlock`), so
 * over live footage the game shows here. Small, but it is what separates
 * "this heads the group" from "this is the group's first entry". 6 rather
 * than the 4 it was as a seam of paper, so the footage in it reads as a gap
 * rather than a hairline.
 */
export const BAND_GAP = 6;

/**
 * Height of the marker where a capped class group skips part of its order
 * (between the leaders and the cars around the player). Small: it only has to
 * say "cars missing here", and every pixel it takes is one a row could use.
 */
export const SKIP_H = 10;

/** Every column in the timing table, in render order. */
export type StandingsColumnId =
  | "pos"
  | "change"
  | "num"
  | "brand"
  | "country"
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
 *
 * The order reads as three blocks. **Rank** first — the class-coloured position
 * block sits flush against the class edge, directly under the band's class name,
 * so band, edge and block form one vertical of identity colour down the group.
 * Then **the car** (number, make) and **the driver** (flag, name), so the
 * nationality sits against the name it belongs to. The name absorbs the slack,
 * which puts the one unavoidable run of empty width *between* who-it-is and the
 * timing data rather than stranding the car's mark out in the middle of it.
 */
export const STANDINGS_COLUMNS: readonly ColumnDef[] = [
  { id: "pos", label: "Pos", name: "Position", width: "2.1rem", px: 34, align: "center", always: true },
  { id: "change", label: "Δ", name: "Position change", width: "1.8rem", px: 29, align: "center" },
  { id: "num", label: "#", name: "Car number", width: "2.5rem", px: 40, align: "center" },
  // Wide enough that the widest marks — Audi's rings, Aston Martin's wings, a
  // wordmark — sit inside the column with paper either side, rather than
  // running up to the number and the flag beside them, and wide enough that a
  // wordmark's letters print large enough to read (see `.brand-icon--wide`).
  { id: "brand", label: "Car", name: "Car brand", width: "4rem", px: 64, align: "center" },
  { id: "country", label: "Nat", name: "Country flag", width: "1.7rem", px: 27, align: "center" },
  // `minmax(0, 1fr)`, not `minmax(8rem, 1fr)`: the name absorbs all slack and is
  // the only column allowed to truncate. An 8rem floor made the grid overflow
  // its container instead, which is how fixed columns ended up holding empty
  // space while `Francois Sieg…` clipped (rule 6).
  { id: "driver", label: "Driver", name: "Driver", width: "minmax(0, 1fr)", px: 136, align: "left", always: true },
  { id: "license", label: "Lic", name: "License / SR", width: "3.4rem", px: 54, align: "center" },
  // Wide enough for a five-digit rating and its change, now that the rating
  // prints in full (`8895 ▲14`) rather than as `8.9k`.
  { id: "irating", label: "iR", name: "iRating", width: "5.2rem", px: 83, align: "right" },
  { id: "gap", label: "Gap", name: "Gap to leader", width: "3.6rem", px: 58, align: "right" },
  { id: "interval", label: "Int", name: "Interval", width: "3.6rem", px: 58, align: "right" },
  { id: "last", label: "Last", name: "Last lap", width: "4.9rem", px: 78, align: "right" },
  { id: "best", label: "Best", name: "Best lap", width: "4.9rem", px: 78, align: "right" },
  // The Relative's column width: a brand-mark-sized badge and a three-digit
  // lap count side by side (`TireCell`).
  { id: "tire", label: "Tyre", name: "Tyre compound", width: "3.4rem", px: 54, align: "center" },
  { id: "sectors", label: "S", name: "Sector deltas", width: "3rem", px: 48, align: "center" },
  { id: "state", label: "", name: "Pit / off-track", width: "2.2rem", px: 35, align: "center", always: true },
];

/**
 * Where a Standings row's class fill (`lib/classFill`) has faded out: the
 * row's `px-1` plus the position column, measured from the inside of the class
 * edge. The class band uses the same reach — its name sits in a box of the
 * position column's width behind the same `0.25rem` — so the band's name and
 * the column of positions under it sit on one fill.
 */
export const STANDINGS_FILL_REACH = `calc(0.25rem + ${
  STANDINGS_COLUMNS.find((c) => c.id === "pos")!.width
})`;

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
 * The class-colour bar down a row's left edge — 3 px, held at its drawn size
 * however far the table scales down. In a single-class session it is drawn
 * transparent: the width stays, so nothing moves, but no class colour shows.
 *
 * It went from 2 px to 3 px because on near-black paper a 2 px hairline of an
 * arbitrary hue was the first thing to disappear in peripheral vision, which is
 * where this surface is read. A uniform scale takes it straight back under
 * that: at 0.6 a 3 px border draws at 1.8 px, thinner than the width already
 * rejected. Dividing by the scale inside the scaled box holds it at its drawn
 * width on screen — the one measurement on this surface that means the same
 * thing at every size, because what it carries is presence rather than
 * quantity.
 *
 * Back to 3 px from the 4 it grew to while the class band was a solid block
 * of the same colour: the band is a neutral header now, and class colour is
 * carried by this bar alone, so it only has to be findable, not to match a
 * block. Three is the narrowest that still is in peripheral vision.
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
