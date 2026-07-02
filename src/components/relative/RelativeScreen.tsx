/**
 * v0.5.0 — Relative Screen
 *
 * Shows the N cars physically nearest to the player on track, sorted by
 * signed relative time gap (positive = ahead, negative = behind). The window
 * is configurable (3–10 per side) via the header controls.
 *
 * Data source: `StandingsEntry.intervalToPlayer` — already computed by the
 * bridge from `CarIdxEstTime` and wrapped to ±half-lap — so this screen is
 * purely a frontend transform over the existing standings channel.
 *
 * Closing-rate hints flag cars that are approaching the player faster than a
 * threshold. A ⚡ icon in the closing column indicates the car is gaining
 * meaningful seconds per lap; the icon is red when the faster car is also from
 * a different class (the most critical multi-class situation).
 */

import { memo, useMemo, useState } from "react";
import { Minus, Plus, Radio, Wrench, Zap } from "lucide-react";
import { useBridgeStore } from "../../stores/useBridgeStore";
import {
  useStandingsClasses,
  useStandingsStore,
} from "../../stores/useStandingsStore";
import { useDriversByIdx, useSessionStore } from "../../stores/useSessionStore";
import type { DriverEntry, StandingsEntry } from "../../telemetry/types";
import { lapTime } from "../../lib/format";
import { BrandIcon } from "../standings/cells";

// ─── Layout constants ────────────────────────────────────────────────────────

const ROW_H = 32;
/** 7-column grid: pos · # · driver · class · gap · last · hint */
const GRID =
  "2.2rem 2.4rem minmax(9rem, 1fr) 3rem 5.2rem 4.8rem 1.6rem";

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

function ColHeader() {
  return (
    <div
      className="sticky top-0 z-10 grid items-center gap-x-1 border-b border-border bg-surface px-2 text-[10px] font-semibold uppercase tracking-wider text-muted"
      style={{ gridTemplateColumns: GRID, height: 26 }}
    >
      <div className="text-center">P</div>
      <div className="text-center">#</div>
      <div>Driver</div>
      <div className="text-center">CL</div>
      <div className="text-right">Gap</div>
      <div className="text-right">Last</div>
      <div />
    </div>
  );
}

// ─── Separator ───────────────────────────────────────────────────────────────

function Separator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted/60">
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
  isPlayer?: boolean;
}

function RowInner({
  entry,
  driver,
  classColor,
  playerLastLap,
  playerClassId,
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
    ? "var(--color-accent)"
    : isBehind
      ? "var(--color-danger)"
      : "var(--color-text)";

  return (
    <div
      className={[
        "grid items-center gap-x-1 px-2 text-xs",
        isPlayer ? "rounded-sm bg-accent/10 ring-1 ring-inset ring-accent/30" : "",
        dimmed ? "opacity-35" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        gridTemplateColumns: GRID,
        height: ROW_H,
        borderLeft: `2px solid ${isPlayer ? classColor : `${classColor}55`}`,
      }}
    >
      {/* overall position */}
      <div className="text-center text-[12px] font-semibold tabular-nums tnum text-muted">
        {entry.position ?? "—"}
      </div>

      {/* car number */}
      <div className="truncate rounded bg-surface-2 text-center text-[11px] font-semibold tabular-nums tnum text-muted">
        {driver?.carNumber ?? "—"}
      </div>

      {/* driver name + brand icon */}
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className="truncate text-[12px]"
          style={{ color: isPlayer ? "var(--color-accent)" : "var(--color-text)" }}
        >
          {driver?.userName ?? `Car ${entry.carIdx}`}
        </span>
        <BrandIcon make={driver?.carMake ?? ""} />
      </div>

      {/* class badge */}
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

      {/* signed relative gap */}
      <div
        className="text-right text-[12px] font-semibold tabular-nums tnum"
        style={{ color: gapColor }}
      >
        {isPlayer ? "0.0s" : `${fmtGap(gap)}s`}
      </div>

      {/* last lap */}
      <div className="text-right text-[11px] tabular-nums tnum text-muted">
        {lapTime(entry.lastLapTime)}
      </div>

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
        <div className="grid size-12 place-items-center rounded-xl border border-border bg-surface-2">
          <Radio className="size-6 text-muted" />
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

interface HeaderProps {
  window: number;
  onWindowChange: (n: number) => void;
}

function RelativeHeader({ window: n, onWindowChange }: HeaderProps) {
  const session = useSessionStore((s) => s.session);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-3 py-2">
      <span className="text-sm font-semibold text-text">Relative</span>
      <span className="text-xs text-muted">
        {session?.track.name ?? "—"}
        {session?.track.config ? ` · ${session.track.config}` : ""}
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        <span className="text-[11px] text-muted">
          ±{n}
        </span>
        <button
          type="button"
          onClick={() => onWindowChange(Math.max(3, n - 1))}
          disabled={n <= 3}
          className="grid size-6 place-items-center rounded text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-30"
          title="Show fewer cars"
        >
          <Minus className="size-3" />
        </button>
        <button
          type="button"
          onClick={() => onWindowChange(Math.min(10, n + 1))}
          disabled={n >= 10}
          className="grid size-6 place-items-center rounded text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-30"
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

  const [windowSize, setWindowSize] = useState(5);

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

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <RelativeHeader window={windowSize} onWindowChange={setWindowSize} />

      {isEmpty ? (
        <EmptyState iracingActive={iracingActive} />
      ) : (
        <div className="flex flex-1 flex-col overflow-auto">
          <ColHeader />

          <div className="flex flex-col gap-0.5 p-1">
            {/* Cars ahead — furthest at top, closest just above player */}
            {ahead.map((entry) => {
              const color = classColorMap.get(entry.carClassId) ?? "#666666";
              return (
                <Row
                  key={entry.carIdx}
                  entry={entry}
                  driver={driversByIdx.get(entry.carIdx)}
                  classColor={color}
                  playerLastLap={playerLastLap}
                  playerClassId={playerClassId}
                />
              );
            })}

            <Separator label="you" />

            {/* Player row */}
            {player && (
              <Row
                key={player.carIdx}
                entry={player}
                driver={driversByIdx.get(player.carIdx)}
                classColor={playerClassColor}
                playerLastLap={playerLastLap}
                playerClassId={playerClassId}
                isPlayer
              />
            )}

            <Separator label="behind" />

            {/* Cars behind — closest at top, furthest at bottom */}
            {behind.map((entry) => {
              const color = classColorMap.get(entry.carClassId) ?? "#666666";
              return (
                <Row
                  key={entry.carIdx}
                  entry={entry}
                  driver={driversByIdx.get(entry.carIdx)}
                  classColor={color}
                  playerLastLap={playerLastLap}
                  playerClassId={playerClassId}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
