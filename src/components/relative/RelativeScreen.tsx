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
 * Responsive: the column set adapts to the window width — optional columns
 * (last lap, car number, flags, brand, class badge) drop out one by one as the
 * overlay gets narrower, so the essential pos/driver/gap trio never crushes.
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
import { useDriversByIdx } from "../../stores/useSessionStore";
import { useRelativeUiStore } from "../../stores/useRelativeUiStore";
import type { DriverEntry, StandingsEntry } from "../../telemetry/types";
import { lapTime } from "../../lib/format";
import { BrandIcon } from "../standings/cells";
import { LAP_UNDERLINE } from "../standings/constants";
import { CountryFlag } from "../ui/CountryFlag";
import { SessionStrip } from "../timing/SessionStrip";

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
  | "pos"
  | "num"
  | "country"
  | "driver"
  | "brand"
  | "class"
  | "gap"
  | "last"
  | "hint";

const REL_COLUMNS: { id: RelColumnId; width: string; px: number }[] = [
  { id: "pos", width: "2.3rem", px: 37 },
  { id: "num", width: "2.5rem", px: 40 },
  { id: "country", width: "1.7rem", px: 27 },
  // `minmax(0, 1fr)`: the name absorbs all slack and is the only column allowed
  // to truncate (`design.md` § Dense tabular overlays, rule 6). `px` stays a
  // target, so a narrow overlay drops a column before crushing the name.
  { id: "driver", width: "minmax(0, 1fr)", px: 112 },
  { id: "brand", width: "2rem", px: 32 },
  { id: "class", width: "3.2rem", px: 51 },
  { id: "gap", width: "4.8rem", px: 77 },
  { id: "last", width: "5rem", px: 80 },
  { id: "hint", width: "1.8rem", px: 29 },
];

/** Auto-hide order (first dropped) when the window gets too narrow. */
const REL_DROP_ORDER: RelColumnId[] = [
  "last",
  "num",
  "country",
  "brand",
  "class",
];

type RelVisibility = (id: RelColumnId) => boolean;

/**
 * Resolve the visible column set: the user's brand/country choices as the
 * upper bound, then columns auto-dropped in {@link REL_DROP_ORDER} until the
 * table fits the measured width.
 */
function relVisibleColumns(
  width: number,
  showBrand: boolean,
  showCountry: boolean
): RelVisibility {
  const dropped = new Set<RelColumnId>();
  const isOn: RelVisibility = (id) =>
    !dropped.has(id) &&
    (id === "brand" ? showBrand : id === "country" ? showCountry : true);
  if (width > 0) {
    // Column widths + the 4px inter-column gaps + the row's px-2 padding.
    const minWidth = () => {
      const on = REL_COLUMNS.filter((c) => isOn(c.id));
      return (
        on.reduce((sum, c) => sum + c.px, 0) +
        Math.max(0, on.length - 1) * 4 +
        20
      );
    };
    for (const id of REL_DROP_ORDER) {
      if (minWidth() <= width) break;
      dropped.add(id);
    }
  }
  return isOn;
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
  pos: "P",
  num: "#",
  country: "",
  driver: "Driver",
  brand: "",
  class: "CL",
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
 * Marks the you/behind boundary with whitespace and a micro-label — no rule.
 * Rule 1 bans row separators outright: at this density a hairline costs more
 * attention than it returns, and the primary-tinted player row plus the sign of
 * the gap already carry the boundary.
 */
function Separator({ label }: { label: string }) {
  return (
    <div className="px-2 pt-1.5 pb-0.5 font-mono text-[9px] font-bold uppercase leading-none tracking-[0.18em] text-faint">
      {label}
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface RowProps {
  entry: StandingsEntry;
  driver: DriverEntry | undefined;
  classColor: string;
  playerLastLap: number | null;
  playerClassId: number;
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

  const isDiffClass = !isPlayer && entry.carClassId !== playerClassId;
  const dimmed = !isPlayer && (entry.isRetired || !entry.isInWorld);

  // "This is you" is the row's ground (`bg-primary/10` + ring), never its ink —
  // tinting the value too would put an identity colour and a status colour in the
  // same glyph (§ Two colour systems, rule 3). So the player's own gap, which is
  // always 0.0s, reads as plain text.
  const gapColor = isBehind ? "var(--color-danger)" : "var(--color-text)";

  return (
    <div
      className={[
        "relative grid items-center gap-x-1 px-2 text-xs",
        isPlayer ? "rounded-sm bg-primary/10 ring-1 ring-inset ring-primary/35" : "",
        dimmed ? "opacity-35" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        gridTemplateColumns: template,
        height: ROW_H,
        // The 2 px left border is this surface's single carrier of car-class
        // colour (§ Two colour systems, rule 2).
        // 3 px, up from 2: on near-black paper a 2 px hairline of an arbitrary
        // hue was the first thing to go in peripheral vision.
        borderLeft: `3px solid ${isPlayer ? classColor : `${classColor}66`}`,
        // Clear the in-row column labels rather than centring under them.
        paddingTop: labelled ? REL_LABEL_H : undefined,
      }}
    >
      {labelled && <ColumnLabels isOn={isOn} template={template} />}

      {/* overall position */}
      <div className="text-center text-[14px] font-bold tabular-nums tnum text-muted">
        {entry.position ?? "—"}
      </div>

      {/* car number — no pill (rule 5), `muted` floor (§ Deliberately not adopted) */}
      {isOn("num") && (
        <div className="truncate text-center text-[12px] font-bold tabular-nums tnum text-muted">
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

      {/* driver name — plain `text` even for the player; the row's ground says
          "you" (§ Two colour systems, rule 3) */}
      <div className="flex min-w-0 items-center">
        <span className="truncate text-[13px] font-semibold text-text">
          {driver?.userName ?? `Car ${entry.carIdx}`}
        </span>
      </div>

      {/* car brand */}
      {isOn("brand") && (
        <div className="flex justify-center">
          <BrandIcon make={driver?.carMake ?? ""} />
        </div>
      )}

      {/* class badge — a label, not a second carrier of the class colour. The
          left border already carries identity; tinting, filling or outlining a
          badge with the same arbitrary hue puts it back in competition with the
          status colours in the same row (§ Two colour systems, rule 2). */}
      {isOn("class") && (
        <div className="flex justify-center">
          <span className="font-mono text-[10px] font-bold uppercase leading-tight tracking-[0.06em] text-muted">
            {driver?.carClassShortName ?? "?"}
          </span>
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
          style={
            LAP_UNDERLINE[entry.lastLapStatus]
              ? {
                  textDecoration: "underline",
                  textDecorationColor: LAP_UNDERLINE[entry.lastLapStatus],
                  textDecorationThickness: 2,
                  textUnderlineOffset: 3,
                }
              : undefined
          }
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

  const isOn = useMemo(
    () => relVisibleColumns(width, showBrand, showCountry),
    [width, showBrand, showCountry]
  );
  const template = useMemo(() => relGridTemplate(isOn), [isOn]);

  // Build a color map keyed by carClassId.
  const classColorMap = useMemo(
    () => new Map(classes.map((c) => [c.carClassId, c.color])),
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
  const playerClassColor = classColorMap.get(playerClassId) ?? "#666666";
  const playerLastLap = playerEntry?.lastLapTime ?? null;

  const isEmpty = order.length === 0;

  const rowProps = { playerLastLap, playerClassId, isOn, template };
  // The first row of the table carries the labels when they are on: the
  // furthest car ahead, or the player when nobody is ahead of them.
  const labelRow = showColumnLabels;

  return (
    <div
      ref={bodyRef}
      className="overlay-card timing-surface @container flex h-full flex-col overflow-hidden rounded-card border border-border/60"
    >
      {showSessionStrip && !isEmpty && <SessionStrip width={width} />}
      {isEmpty ? (
        <EmptyState iracingActive={iracingActive} />
      ) : (
        <div className="flex flex-1 flex-col overflow-auto">
          {/* No column-header band ever: when labels are on at all they ride in
              the first row's top slice, out of flow (rule 3). */}
          <div className="flex flex-col gap-0.5 p-1">
            {/* Cars ahead — furthest at top, closest just above player */}
            {ahead.map((entry, i) => (
              <Row
                key={entry.carIdx}
                entry={entry}
                driver={driversByIdx.get(entry.carIdx)}
                classColor={classColorMap.get(entry.carClassId) ?? "#666666"}
                labelled={labelRow && i === 0}
                {...rowProps}
              />
            ))}

            <Separator label="you" />

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

            <Separator label="behind" />

            {/* Cars behind — closest at top, furthest at bottom */}
            {behind.map((entry) => (
              <Row
                key={entry.carIdx}
                entry={entry}
                driver={driversByIdx.get(entry.carIdx)}
                classColor={classColorMap.get(entry.carClassId) ?? "#666666"}
                {...rowProps}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
