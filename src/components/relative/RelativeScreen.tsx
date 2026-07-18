/**
 * v0.5.0 — Relative Screen
 *
 * Shows the N cars physically nearest to the player on track, sorted by
 * signed relative time gap (positive = ahead, negative = behind). The window
 * is configurable (3–10 per side) via the header controls and persisted in
 * {@link useRelativeUiStore}, together with the brand/country column options
 * set from the Overlay Manager.
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
import { Minus, Plus, Radio, Wrench, Zap } from "lucide-react";
import { useBridgeStore } from "../../stores/useBridgeStore";
import {
  useStandingsClasses,
  useStandingsStore,
} from "../../stores/useStandingsStore";
import { useDriversByIdx, useSessionStore } from "../../stores/useSessionStore";
import {
  RELATIVE_WINDOW_MAX,
  RELATIVE_WINDOW_MIN,
  useRelativeUiStore,
} from "../../stores/useRelativeUiStore";
import type { DriverEntry, StandingsEntry } from "../../telemetry/types";
import { lapTime } from "../../lib/format";
import { BrandIcon } from "../standings/cells";
import { CountryFlag } from "../ui/CountryFlag";

// ─── Layout constants ────────────────────────────────────────────────────────

const ROW_H = 32;

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
  { id: "pos", width: "2.2rem", px: 35 },
  { id: "num", width: "2.4rem", px: 38 },
  { id: "country", width: "1.6rem", px: 26 },
  { id: "driver", width: "minmax(6.5rem, 1fr)", px: 104 },
  { id: "brand", width: "1.7rem", px: 27 },
  { id: "class", width: "3rem", px: 48 },
  { id: "gap", width: "4.6rem", px: 74 },
  { id: "last", width: "4.8rem", px: 77 },
  { id: "hint", width: "1.6rem", px: 26 },
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

function ColHeader({
  isOn,
  template,
}: {
  isOn: RelVisibility;
  template: string;
}) {
  return (
    <div
      className="sticky top-0 z-10 grid items-center gap-x-1 border-b border-border bg-surface px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-faint"
      style={{ gridTemplateColumns: template, height: 26 }}
    >
      {REL_COLUMNS.filter((c) => isOn(c.id)).map((c) => (
        <div
          key={c.id}
          className={
            c.id === "gap" || c.id === "last"
              ? "text-right"
              : c.id === "driver"
                ? ""
                : "text-center"
          }
        >
          {REL_HEADER_LABEL[c.id]}
        </div>
      ))}
    </div>
  );
}

// ─── Separator ───────────────────────────────────────────────────────────────

function Separator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-faint">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
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

  const gapColor = isPlayer
    ? "var(--color-primary)"
    : isBehind
      ? "var(--color-danger)"
      : "var(--color-text)";

  return (
    <div
      className={[
        "grid items-center gap-x-1 px-2 text-xs",
        isPlayer ? "rounded-sm bg-primary/10 ring-1 ring-inset ring-primary/35" : "",
        dimmed ? "opacity-35" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        gridTemplateColumns: template,
        height: ROW_H,
        borderLeft: `2px solid ${isPlayer ? classColor : `${classColor}55`}`,
      }}
    >
      {/* overall position */}
      <div className="text-center text-[12px] font-semibold tabular-nums tnum text-muted">
        {entry.position ?? "—"}
      </div>

      {/* car number */}
      {isOn("num") && (
        <div className="truncate rounded-[4px] bg-surface-2 text-center text-[11px] font-semibold tabular-nums tnum text-muted">
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

      {/* driver name */}
      <div className="flex min-w-0 items-center">
        <span
          className="truncate text-[12px]"
          style={{ color: isPlayer ? "var(--color-primary)" : "var(--color-text)" }}
        >
          {driver?.userName ?? `Car ${entry.carIdx}`}
        </span>
      </div>

      {/* car brand */}
      {isOn("brand") && (
        <div className="flex justify-center">
          <BrandIcon make={driver?.carMake ?? ""} />
        </div>
      )}

      {/* class badge */}
      {isOn("class") && (
        <div className="flex justify-center">
          <span
            className="rounded px-1 py-px text-[9px] font-bold uppercase leading-tight"
            style={{
              background: `${classColor}1a`,
              color: classColor,
              border: `1px solid ${classColor}44`,
            }}
          >
            {driver?.carClassShortName ?? "?"}
          </span>
        </div>
      )}

      {/* signed relative gap */}
      <div
        className="text-right text-[12px] font-semibold tabular-nums tnum"
        style={{ color: gapColor }}
      >
        {isPlayer ? "0.0s" : `${fmtGap(gap)}s`}
      </div>

      {/* last lap */}
      {isOn("last") && (
        <div className="text-right text-[11px] tabular-nums tnum text-muted">
          {lapTime(entry.lastLapTime)}
        </div>
      )}

      {/* hint column */}
      <div className="flex items-center justify-center">
        {isPlayer && (entry.onPitRoad || entry.isInPitStall) ? (
          <span title="On pit road">
            <Wrench className="size-3 text-warning" />
          </span>
        ) : showAlert ? (
          <span
            title={`Closing at ${closingRate!.toFixed(1)}s/lap${isDiffClass ? " · different class" : ""}`}
          >
            <Zap
              className="size-3"
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

// ─── Header ──────────────────────────────────────────────────────────────────

function RelativeHeader() {
  const session = useSessionStore((s) => s.session);
  const n = useRelativeUiStore((s) => s.windowSize);
  const setWindowSize = useRelativeUiStore((s) => s.setWindowSize);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-3 py-2">
      <span className="text-sm font-semibold tracking-tight text-text">Relative</span>
      <span className="hidden min-w-0 truncate text-xs text-faint @[340px]:block">
        {session?.track.name ?? "—"}
        {session?.track.config ? ` · ${session.track.config}` : ""}
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        <span className="tnum text-[11px] text-muted">
          ±{n}
        </span>
        <button
          type="button"
          onClick={() => setWindowSize(n - 1)}
          disabled={n <= RELATIVE_WINDOW_MIN}
          className="grid size-6 place-items-center rounded-ctl text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-30"
          title="Show fewer cars"
        >
          <Minus className="size-3" />
        </button>
        <button
          type="button"
          onClick={() => setWindowSize(n + 1)}
          disabled={n >= RELATIVE_WINDOW_MAX}
          className="grid size-6 place-items-center rounded-ctl text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-30"
          title="Show more cars"
        >
          <Plus className="size-3" />
        </button>
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

  return (
    <div
      ref={bodyRef}
      className="overlay-card @container flex h-full flex-col overflow-hidden rounded-card border border-border/60 bg-surface"
    >
      <RelativeHeader />

      {isEmpty ? (
        <EmptyState iracingActive={iracingActive} />
      ) : (
        <div className="flex flex-1 flex-col overflow-auto">
          <ColHeader isOn={isOn} template={template} />

          <div className="flex flex-col gap-0.5 p-1">
            {/* Cars ahead — furthest at top, closest just above player */}
            {ahead.map((entry) => (
              <Row
                key={entry.carIdx}
                entry={entry}
                driver={driversByIdx.get(entry.carIdx)}
                classColor={classColorMap.get(entry.carClassId) ?? "#666666"}
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
