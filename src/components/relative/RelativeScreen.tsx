/**
 * v0.5.0 — Relative Screen
 *
 * Shows the N cars physically nearest to the player on track, sorted by
 * signed relative time gap (positive = ahead, negative = behind).
 *
 * The screen is **rows and a readout, and nothing else**: no title bar, nothing
 * clickable. It is read at a glance while the user is driving, so every pixel
 * goes to the field — including the optional session strip above it, which is a
 * readout the driver cannot interact with (`design.md` § Dense tabular overlays,
 * rule 7). The window size (3–10 per side), the brand/country column options and
 * the strip itself are all set from the Overlay Manager and persisted in
 * {@link useRelativeUiStore}, which broadcasts them so an open overlay updates
 * live.
 *
 * Data source: `StandingsEntry.intervalToPlayer` — already computed by the
 * bridge from `CarIdxEstTime` and wrapped to ±half-lap — so this screen is
 * purely a frontend transform over the existing standings channel.
 *
 * Responsive by **scale**, not by subtraction: every column stays on screen at
 * every size and the whole surface shrinks to fit the window (see
 * `lib/tableScale`). It used to shed columns instead — last lap, then car
 * number, flag, brand, class badge — which meant a driver who sized the overlay
 * to fit beside their mirrors quietly lost data they had asked for.
 *
 * Lapped traffic is called out explicitly **in a race**. `intervalToPlayer` is
 * wrapped to ±half a lap, so a car a lap down sitting alongside the player is
 * indistinguishable from a rival by gap alone. A neighbour a lap or more
 * *behind* the player therefore prints in `--color-lapped` blue — the sim's own
 * blue-flag convention — with a signed `-1L` tag; a car a lap or more *ahead*
 * keeps the default ink and carries a `+1L` tag (see {@link lapRelation}; the
 * entry's own `isLapped`/`lapsDown` are leader-relative and cannot answer this).
 *
 * Outside a race the call-out is switched off entirely (see
 * `lib/sessionKind`). Being a lap down only costs you something when there is a
 * position attached to it; in practice or qualifying the field joins at
 * different times and runs its own programmes, so lap numbers differ across the
 * grid by design. Left on, half the table would turn blue and carry a tag — a
 * table shouting at every row is a table saying nothing — and it would bury
 * the one number that still matters there: the gap to the car about to arrive
 * in your mirrors mid-lap.
 *
 * **Exactly one row has a ground, and it is yours.** Lapped traffic used to take
 * a danger-tinted ground and every other row a wash of its class colour; with
 * three kinds of ground in six rows the player's own was one block among many.
 * Lapped is now ink, class is a badge at the start of the row (plus the leading
 * edge), and the only filled row on the surface is the one you are driving.
 *
 * Closing-rate hints flag cars that are approaching the player faster than a
 * threshold. A ⚡ icon in the closing column indicates the car is gaining
 * meaningful seconds per lap; the icon is red when the faster car is also from
 * a different class (the most critical multi-class situation).
 */

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Radio, Wrench, Zap } from "lucide-react";
import { useBridgeStore } from "../../stores/useBridgeStore";
import {
  useStandingsClasses,
  useStandingsStore,
} from "../../stores/useStandingsStore";
import { useDriversByIdx, useRanksByLapTime } from "../../stores/useSessionStore";
import { useRelativeUiStore } from "../../stores/useRelativeUiStore";
import type { DriverEntry, StandingsEntry } from "../../telemetry/types";
import { lapTime } from "../../lib/format";
import type { LapPositioned } from "../../lib/relativeLaps";
import {
  LapRelation,
  lapDelta,
  lapRelation,
  lapTag,
} from "../../lib/relativeLaps";
import { BrandIcon } from "../standings/cells";
import { CLASS_EDGE_WIDTH, LAP_UNDERLINE } from "../standings/constants";
import { CountryFlag } from "../ui/CountryFlag";
import { SessionStrip } from "../timing/SessionStrip";
import { scaleBox, tableScale, unscaled } from "../../lib/tableScale";
import { CLASS_RAMP, classColorFor } from "../../lib/classColors";
import { readableInk } from "../../lib/contrast";
import { formatDriverName } from "../../lib/driverName";

// ─── Layout constants ────────────────────────────────────────────────────────

/**
 * Row height. 34 rather than 32: this surface's type went up a step and to
 * semibold/bold throughout — it is read in peripheral vision while the driver's
 * eyes belong to the track — and the taller row is what keeps 13 px names off
 * the rows above and below.
 */
const ROW_H = 34;

/** Every column the relative table can show, in render order. */
type RelColumnId =
  | "class"
  | "pos"
  | "num"
  | "country"
  | "driver"
  | "brand"
  | "gap"
  | "last"
  | "hint";

const REL_COLUMNS: { id: RelColumnId; width: string; px: number }[] = [
  // The class badge opens the row, against the class edge it repeats: in a
  // multi-class field "which class is this" is the first question asked of a
  // car arriving in the mirrors, so it is the first thing the eye lands on.
  { id: "class", width: "3rem", px: 48 },
  { id: "pos", width: "2.3rem", px: 37 },
  { id: "num", width: "2.5rem", px: 40 },
  { id: "country", width: "1.7rem", px: 27 },
  // `minmax(0, 1fr)`: the name absorbs all slack and is the only column allowed
  // to truncate (`design.md` § Dense tabular overlays, rule 6). `px` is the
  // width it would like, which is what the table's natural width is summed
  // from — and therefore what the scale is measured against.
  { id: "driver", width: "minmax(0, 1fr)", px: 112 },
  { id: "brand", width: "2.75rem", px: 44 },
  { id: "gap", width: "4.8rem", px: 77 },
  { id: "last", width: "5rem", px: 80 },
  { id: "hint", width: "1.8rem", px: 29 },
];

type RelVisibility = (id: RelColumnId) => boolean;

/**
 * The visible column set: the user's brand/country choices, plus the class
 * badge whenever the field has more than one class.
 *
 * The badge is about the *field*, not the window: in a single-class session
 * every row would carry the same label in the same colour, which is a column
 * saying nothing. The leading edge still carries the class either way.
 *
 * There used to be a width-driven drop order here too — last lap, then car
 * number, flag, brand, class badge, shed one by one as the overlay narrowed.
 * It is gone for the reason given in `lib/tableScale`: a smaller overlay should
 * be a smaller table, not a different one.
 */
function relVisibleColumns(
  showBrand: boolean,
  showCountry: boolean,
  multiClass: boolean
): RelVisibility {
  return (id) =>
    id === "brand"
      ? showBrand
      : id === "country"
        ? showCountry
        : id === "class"
          ? multiClass
          : true;
}

/** The width this column set wants: widths + 4 px gaps + the row's px-2. */
function relNaturalWidth(isOn: RelVisibility): number {
  const on = REL_COLUMNS.filter((c) => isOn(c.id));
  return (
    on.reduce((sum, c) => sum + c.px, 0) + Math.max(0, on.length - 1) * 4 + 20
  );
}

function relGridTemplate(isOn: RelVisibility): string {
  return REL_COLUMNS.filter((c) => isOn(c.id))
    .map((c) => c.width)
    .join(" ");
}

// ─── Thresholds ──────────────────────────────────────────────────────────────

/** Minimum lap-time advantage (s) to trigger the closing indicator. */
const CLOSE_THRESHOLD = 0.3;
/** Gap window (s) within which the closing indicator is shown. */
const CLOSE_GAP_MAX = 10.0;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a signed relative gap in seconds, e.g. "+3.4" / "-1.2" / "0.0". */
function fmtGap(v: number | null): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs < 0.05) return "0.0";
  const s = abs.toFixed(abs < 100 ? 1 : 0);
  return v > 0 ? `+${s}` : `-${s}`;
}

// ─── Column header ───────────────────────────────────────────────────────────

const REL_HEADER_LABEL: Record<RelColumnId, string> = {
  class: "CL",
  pos: "P",
  num: "#",
  country: "",
  driver: "Driver",
  brand: "",
  gap: "Gap",
  last: "Last",
  hint: "",
};

/** Height of the label line printed inside the table's first row. */
const REL_LABEL_H = 10;

function alignOf(id: RelColumnId): string {
  if (id === "gap" || id === "last") return "text-right";
  if (id === "driver") return "text-left";
  return "text-center";
}

/**
 * Column labels, printed in the top slice of the table's first row rather than
 * in a band of their own (`design.md` § Dense tabular overlays, rule 3). A
 * persistent 26 px band was over 12 % of a six-row Relative spent on labels the
 * user stops reading after their first session; out of flow, these cost nothing.
 *
 * Kept — rather than dropped entirely, as the reference does — because `2.2`,
 * `A3.6` and `3.9k` are undecodable on a first run (§ Deliberately not adopted).
 */
function ColumnLabels({
  isOn,
  template,
}: {
  isOn: RelVisibility;
  template: string;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 grid items-start gap-x-1 px-2 font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-faint"
      style={{ gridTemplateColumns: template, height: REL_LABEL_H }}
    >
      {REL_COLUMNS.filter((c) => isOn(c.id)).map((c) => (
        <div key={c.id} className={`truncate ${alignOf(c.id)}`}>
          {REL_HEADER_LABEL[c.id]}
        </div>
      ))}
    </div>
  );
}

// ─── Separator ───────────────────────────────────────────────────────────────

/**
 * Space either side of the player's row — no rule and no label.
 *
 * It used to print `YOU` above the player and `BEHIND` above the cars behind,
 * with nothing above the cars ahead: two labels for three groups, one of them
 * naming a row already ringed in `primary`. The sign and colour of the gap say
 * ahead or behind on every row, and the ring says which one is you, so all the
 * boundary needs is to be a boundary. Equal space above and below keeps the
 * player's row the visual centre of the table, which is what a relative is.
 */
function Separator() {
  return <div aria-hidden className="h-1.5 shrink-0" />;
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface RowProps {
  entry: StandingsEntry;
  driver: DriverEntry | undefined;
  classColor: string;
  playerLastLap: number | null;
  playerClassId: number;
  /** Player lap position, for the lap-relation comparison. */
  playerLap: LapPositioned;
  /**
   * Whether "a lap ahead / a lap behind" is a thing worth saying at all.
   *
   * False outside a race. Lapped traffic is a race idea: it means someone is
   * losing a position they hold, or about to take one. In a practice session
   * drivers join whenever they like and run their own programmes, so lap
   * numbers differ across the field by design — half the rows would turn blue
   * and carry a tag, which is the whole table shouting and therefore the whole
   * table silent.
   */
  showLapRelation: boolean;
  isOn: RelVisibility;
  template: string;
  isPlayer?: boolean;
  /** First row of the table: carries the column labels (rule 3). */
  labelled?: boolean;
}

function RowInner({
  entry,
  driver,
  classColor,
  playerLastLap,
  playerClassId,
  playerLap,
  showLapRelation,
  isOn,
  template,
  isPlayer = false,
  labelled = false,
}: RowProps) {
  const gap = entry.intervalToPlayer;
  const isBehind = !isPlayer && (gap ?? 0) < 0;

  // Closing rate: positive means this car is lapping faster than the player.
  const closingRate =
    !isPlayer && playerLastLap && entry.lastLapTime
      ? playerLastLap - entry.lastLapTime
      : null;

  // Alert: car is behind, gaining, within range, and fast enough to matter.
  const showAlert =
    isBehind &&
    closingRate != null &&
    closingRate > CLOSE_THRESHOLD &&
    Math.abs(gap ?? 0) < CLOSE_GAP_MAX;

  // Lap standing vs. the player — the thing the wrapped gap cannot express, and
  // only worth expressing where being a lap down costs you something.
  const comparable = showLapRelation && !isPlayer;
  const relation = comparable
    ? lapRelation(entry, playerLap)
    : LapRelation.SameLap;
  const tag = comparable ? lapTag(lapDelta(entry, playerLap)) : null;

  // A lap or more behind the player: traffic you are lapping. The only row
  // state on this surface carried by ink rather than ground — see `ink` below.
  const lapped = relation === LapRelation.Lapping;

  const isDiffClass = !isPlayer && entry.carClassId !== playerClassId;
  const dimmed = !isPlayer && (entry.isRetired || !entry.isInWorld);

  // The row's ink. Lapped traffic prints every value in `--color-lapped` blue —
  // the sim's own blue-flag convention, so it is read rather than learned — and
  // every other row keeps the surface's default ink. Ink, not ground: the one
  // ground on this surface is the player's, and a lapped car is never you.
  const ink = lapped ? "var(--color-lapped)" : undefined;

  // "This is you" is the row's ground (`bg-primary/15` + ring), never its ink —
  // tinting the value too would put an identity colour and a status colour in the
  // same glyph (§ Two colour systems, rule 3). So the player's own gap, which is
  // always 0.0s, reads as plain text. Lapped blue outranks the behind-red: a
  // lapped car is behind you by definition, and the blue is the louder fact.
  const gapColor =
    ink ?? (isBehind ? "var(--color-danger)" : "var(--color-text)");

  return (
    <div
      className={[
        "relative grid items-center gap-x-1 px-2 text-xs",
        "rounded-sm",
        // The only ground on the surface (§ Dense tabular overlays, rule 14).
        // Off-lap rows used to take a danger tint and every other row a wash
        // of its class colour, which left the player's row one block of
        // colour among six; class now rides in the badge and the edge, and
        // lapped traffic in the ink.
        isPlayer ? "bg-primary/15 ring-1 ring-inset ring-primary/60" : "",
        dimmed ? "opacity-35" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        gridTemplateColumns: template,
        height: ROW_H,
        // The class edge, at full strength on every row exactly as on Standings
        // — the same device has to read the same way on both surfaces. It holds
        // its drawn size as the table scales down (see CLASS_EDGE_WIDTH).
        borderLeftWidth: CLASS_EDGE_WIDTH,
        borderLeftStyle: "solid",
        borderLeftColor: classColor,
        // Clear the in-row column labels rather than centring under them.
        paddingTop: labelled ? REL_LABEL_H : undefined,
      }}
    >
      {labelled && <ColumnLabels isOn={isOn} template={template} />}

      {/* class badge — the class's short name on a solid block of its colour,
          directly against the edge it repeats. It is the Relative's version of
          Standings' position block: a heading-sized identity fill, one per
          row, ink measured by `readableInk` (§ Dense tabular overlays, rule
          11). Only drawn in a multi-class field. */}
      {isOn("class") && (
        <div className="flex justify-center">
          <span
            className="min-w-0 max-w-full truncate rounded-ctl px-1 py-0.5 text-center font-mono text-[10px] font-bold uppercase leading-none tracking-[0.04em]"
            style={{ background: classColor, color: readableInk(classColor) }}
            title={driver?.carClassShortName || undefined}
          >
            {driver?.carClassShortName || "?"}
          </span>
        </div>
      )}

      {/* overall position */}
      <div
        className="text-center text-[14px] font-bold tabular-nums tnum text-muted"
        style={{ color: ink }}
      >
        {entry.position ?? "—"}
      </div>

      {/* car number — no pill (rule 5), `muted` floor (§ Deliberately not adopted) */}
      {isOn("num") && (
        <div
          className="truncate text-center text-[12px] font-bold tabular-nums tnum text-muted"
          style={{ color: ink }}
        >
          {driver?.carNumber ?? "—"}
        </div>
      )}

      {/* country flag */}
      {isOn("country") && (
        <div className="flex justify-center">
          <CountryFlag
            code={driver?.countryCode ?? ""}
            name={driver?.countryName}
          />
        </div>
      )}

      {/* driver name — `text` for everyone but lapped traffic, the player
          included; the row's ground says "you" (§ Two colour systems, rule 3).
          Title case through the same `formatDriverName` Standings uses: the
          two surfaces are read the same way and must not set the same fact
          two ways. */}
      <div className="flex min-w-0 items-center gap-1">
        <span
          className="truncate text-[13px] font-bold tracking-[0.01em] text-text"
          style={{ color: ink }}
        >
          {formatDriverName(driver?.userName) || `Car ${entry.carIdx}`}
        </span>
        {tag && (
          <span
            className="shrink-0 font-mono text-[9px] font-bold leading-none tracking-[0.06em] text-muted"
            style={{ color: ink }}
            title={
              relation === LapRelation.LappedBy
                ? "A lap or more ahead — faster car coming through"
                : "A lap or more behind — traffic you are lapping"
            }
          >
            {tag}
          </span>
        )}
      </div>

      {/* car brand */}
      {isOn("brand") && (
        <div className="flex justify-center">
          <BrandIcon make={driver?.carMake ?? ""} />
        </div>
      )}

      {/* signed relative gap */}
      <div
        className="text-right text-[13px] font-bold tabular-nums tnum"
        style={{ color: gapColor }}
      >
        {isPlayer ? "0.0s" : `${fmtGap(gap)}s`}
      </div>

      {/* last lap, ruled rather than recoloured when it grades — the digits are
          what the driver compares, so the grade rides underneath them
          (`design.md` § Dense tabular overlays, rule 10) */}
      {isOn("last") && (
        <div
          className="text-right text-[12px] font-semibold tabular-nums tnum text-muted"
          style={{
            color: ink,
            ...(LAP_UNDERLINE[entry.lastLapStatus]
              ? {
                  textDecoration: "underline",
                  textDecorationColor: LAP_UNDERLINE[entry.lastLapStatus],
                  textDecorationThickness: 2,
                  textUnderlineOffset: 3,
                }
              : undefined),
          }}
        >
          {lapTime(entry.lastLapTime)}
        </div>
      )}

      {/* hint column */}
      <div className="flex items-center justify-center">
        {isPlayer && (entry.onPitRoad || entry.isInPitStall) ? (
          <span title="On pit road">
            <Wrench className="size-3.5 text-warning" />
          </span>
        ) : showAlert ? (
          <span
            title={`Closing at ${closingRate!.toFixed(1)}s/lap${isDiffClass ? " · different class" : ""}`}
          >
            <Zap
              className="size-3.5"
              style={{
                color: isDiffClass
                  ? "var(--color-danger)"
                  : "var(--color-warning)",
              }}
            />
          </span>
        ) : null}
      </div>
    </div>
  );
}

const Row = memo(RowInner);

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ iracingActive }: { iracingActive: boolean }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="grid size-12 place-items-center rounded-card border border-border bg-surface-2">
          <Radio className="size-6 text-faint" />
        </div>
        <h2 className="text-base font-semibold text-text">No relative data</h2>
        <p className="text-sm leading-relaxed text-muted">
          {iracingActive
            ? "Waiting for the standings feed…"
            : "Start a session in iRacing (or run the mock bridge) to see the relative."}
        </p>
      </div>
    </div>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export function RelativeScreen() {
  const iracingActive = useBridgeStore((s) => s.iracingActive);
  const byIdx = useStandingsStore((s) => s.byIdx);
  const order = useStandingsStore((s) => s.order);
  const classes = useStandingsClasses();
  const driversByIdx = useDriversByIdx();

  const windowSize = useRelativeUiStore((s) => s.windowSize);
  const showBrand = useRelativeUiStore((s) => s.showBrand);
  const showCountry = useRelativeUiStore((s) => s.showCountry);
  const showSessionStrip = useRelativeUiStore((s) => s.showSessionStrip);
  const showColumnLabels = useRelativeUiStore((s) => s.showColumnLabels);
  const byLapTime = useRanksByLapTime();

  // Measure our own width so the column set can adapt to the window.
  const bodyRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const multiClass = classes.length > 1;
  const isOn = useMemo(
    () => relVisibleColumns(showBrand, showCountry, multiClass),
    [showBrand, showCountry, multiClass]
  );
  const template = useMemo(() => relGridTemplate(isOn), [isOn]);

  // Scale the whole table to the width it has, rather than shedding columns to
  // fit — see `lib/tableScale`.
  const scale = tableScale(width, relNaturalWidth(isOn));
  const innerWidth = unscaled(width, scale);

  // Identity colour from this app's ramp, keyed by the class's position in the
  // field's order — the same colour Standings gives the class, and not
  // iRacing's `carClassColor`, which is free to land on the blue this screen
  // spends on lapped traffic or on the player's row (see `lib/classColors`).
  const classColorMap = useMemo(
    () => new Map(classes.map((c, i) => [c.carClassId, classColorFor(i)])),
    [classes]
  );

  // Derive the relative view:
  //   1. Sort all active cars by intervalToPlayer descending (most ahead first).
  //   2. Find the player in that list.
  //   3. Slice N above and N below.
  const { ahead, player, behind, playerEntry } = useMemo(() => {
    const all = order
      .map((idx) => byIdx[idx])
      .filter(
        (e): e is StandingsEntry =>
          !!e && e.isInWorld && e.intervalToPlayer != null
      )
      .sort((a, b) => (b.intervalToPlayer ?? 0) - (a.intervalToPlayer ?? 0));

    const playerIdx = all.findIndex((e) => e.isPlayer);
    if (playerIdx < 0) {
      return { ahead: [], player: null, behind: [], playerEntry: undefined };
    }

    const pEntry = all[playerIdx];
    const aheadSlice = all.slice(
      Math.max(0, playerIdx - windowSize),
      playerIdx
    );
    const behindSlice = all.slice(playerIdx + 1, playerIdx + 1 + windowSize);

    return {
      ahead: aheadSlice,
      player: pEntry,
      behind: behindSlice,
      playerEntry: pEntry,
    };
  }, [order, byIdx, windowSize]);

  const playerClassId = playerEntry?.carClassId ?? -1;
  const playerClassColor = classColorMap.get(playerClassId) ?? CLASS_RAMP[0];
  const playerLastLap = playerEntry?.lastLapTime ?? null;

  const isEmpty = order.length === 0;

  // The player's own lap position, against which every neighbour is compared.
  // Defaults to a no-lap car so rows classify as Unknown (never as lapped)
  // while the player's own data is still missing.
  // Memoized on the two values it holds: `Row` is memoized, and a fresh object
  // every render would re-render every row on every telemetry frame.
  const playerLap = useMemo<LapPositioned>(
    () => ({
      lap: playerEntry?.lap ?? null,
      lapDistPct: playerEntry?.lapDistPct ?? null,
    }),
    [playerEntry?.lap, playerEntry?.lapDistPct]
  );

  const rowProps = {
    playerLastLap,
    playerClassId,
    playerLap,
    showLapRelation: !byLapTime,
    isOn,
    template,
  };
  // The first row of the table carries the labels when they are on: the
  // furthest car ahead, or the player when nobody is ahead of them.
  const labelRow = showColumnLabels;

  return (
    <div
      ref={bodyRef}
      className="overlay-card timing-surface @container flex h-full flex-col overflow-hidden rounded-card border border-border/60"
    >
      {showSessionStrip && !isEmpty && (
        <div style={scaleBox(scale)}>
          <SessionStrip width={innerWidth} />
        </div>
      )}
      {isEmpty ? (
        <EmptyState iracingActive={iracingActive} />
      ) : (
        <div className="flex flex-1 flex-col overflow-auto">
          {/* No column-header band ever: when labels are on at all they ride in
              the first row's top slice, out of flow (rule 3). */}
          <div className="flex flex-col gap-0.5 p-1" style={scaleBox(scale)}>
            {/* Cars ahead — furthest at top, closest just above player */}
            {ahead.map((entry, i) => (
              <Row
                key={entry.carIdx}
                entry={entry}
                driver={driversByIdx.get(entry.carIdx)}
                classColor={classColorMap.get(entry.carClassId) ?? CLASS_RAMP[0]}
                labelled={labelRow && i === 0}
                {...rowProps}
              />
            ))}

            <Separator />

            {/* Player row */}
            {player && (
              <Row
                key={player.carIdx}
                entry={player}
                driver={driversByIdx.get(player.carIdx)}
                classColor={playerClassColor}
                labelled={labelRow && ahead.length === 0}
                {...rowProps}
                isPlayer
              />
            )}

            <Separator />

            {/* Cars behind — closest at top, furthest at bottom */}
            {behind.map((entry) => (
              <Row
                key={entry.carIdx}
                entry={entry}
                driver={driversByIdx.get(entry.carIdx)}
                classColor={classColorMap.get(entry.carClassId) ?? CLASS_RAMP[0]}
                {...rowProps}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
