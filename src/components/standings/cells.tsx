import { ChevronDown, ChevronUp } from "lucide-react";
import type { SectorSplit } from "../../telemetry/types";
import {
  delta as fmtDelta,
  gap as fmtGap,
  interval as fmtInterval,
  lapTime,
  sectorTime,
} from "../../lib/format";
import { LAP_COLOR, SECTOR_COLOR } from "./constants";

/* -------------------------------------------------------------------------- */
/*  Position-change arrow (▲2 / ▼1) — gain since the green flag                */
/* -------------------------------------------------------------------------- */

export function PosChange({ value }: { value: number }) {
  if (!value) {
    return <span className="text-[10px] leading-none text-muted/40">·</span>;
  }
  const up = value > 0;
  const Icon = up ? ChevronUp : ChevronDown;
  return (
    <span
      className="flex items-center justify-center gap-px text-[10px] font-semibold leading-none tnum"
      style={{ color: up ? "var(--color-accent)" : "var(--color-danger)" }}
      title={`${up ? "Gained" : "Lost"} ${Math.abs(value)} since start`}
    >
      <Icon className="size-2.5" strokeWidth={3} />
      {Math.abs(value)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  iRating + projected live change (8895 ▲14)                                */
/* -------------------------------------------------------------------------- */

export function IRatingCell({
  iRating,
  change,
}: {
  iRating: number;
  change: number;
}) {
  const up = change > 0;
  return (
    <div className="flex items-baseline justify-end gap-1 tnum">
      <span className="text-[11px] text-text/90">
        {iRating > 0 ? (iRating / 1000).toFixed(1) + "k" : "—"}
      </span>
      {change !== 0 && (
        <span
          className="text-[9px] font-semibold leading-none"
          style={{ color: up ? "var(--color-accent)" : "var(--color-danger)" }}
          title="Projected iRating change (estimate)"
        >
          {up ? "▲" : "▼"}
          {Math.abs(change)}
        </span>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  License + safety rating badge (A 3.45)                                     */
/* -------------------------------------------------------------------------- */

export function LicenseBadge({
  group,
  safetyRating,
  color,
}: {
  group: string;
  safetyRating: number;
  color: string;
}) {
  return (
    <span
      className="inline-flex items-center rounded px-1 text-[10px] font-semibold leading-tight tnum"
      style={{ background: `${color}22`, color }}
      title={`${group} ${safetyRating.toFixed(2)}`}
    >
      {group}
      {safetyRating.toFixed(1)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Car-brand pill ([Audi])                                                   */
/* -------------------------------------------------------------------------- */

export function BrandBadge({ make }: { make: string }) {
  if (!make) return null;
  return (
    <span className="truncate rounded bg-surface-2 px-1 text-[9px] uppercase tracking-wide text-muted">
      {make}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Gap / interval / lap cells                                                */
/* -------------------------------------------------------------------------- */

export function GapCell({
  value,
  isLaps,
}: {
  value: number | null;
  isLaps: boolean;
}) {
  return (
    <span className="text-right text-[11px] tabular-nums text-text/80 tnum">
      {fmtGap(value, isLaps)}
    </span>
  );
}

export function IntervalCell({ value }: { value: number | null }) {
  return (
    <span className="text-right text-[11px] tabular-nums text-text/80 tnum">
      {fmtInterval(value)}
    </span>
  );
}

export function LapCell({
  time,
  color,
  flash,
}: {
  time: number | null;
  color?: string;
  flash?: boolean;
}) {
  return (
    <span
      className={`text-right text-[11px] tabular-nums tnum ${flash ? "sec-flash" : ""}`}
      style={{ color: color ?? "var(--color-text)" }}
    >
      {lapTime(time)}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sector delta cell — the colored .3 / .7 / .7                              */
/* -------------------------------------------------------------------------- */

export function SectorCell({ sector }: { sector: SectorSplit | undefined }) {
  if (!sector || sector.lastTime == null) {
    return <span className="text-center text-[10px] text-muted/30">·</span>;
  }
  const color = SECTOR_COLOR[sector.status] ?? "var(--color-muted)";
  // Purple/green sectors read as the achievement (show the time); yellow/red
  // read as the loss (show the signed delta vs personal best).
  const isBest =
    sector.status === "overall_best" || sector.status === "personal_best";
  const showDelta = !isBest && sector.delta != null;
  const label = showDelta ? fmtDelta(sector.delta) : sectorTime(sector.lastTime);
  return (
    <span
      key={`${sector.status}-${sector.lastTime}`}
      className="sec-cell text-center text-[10px] font-medium tabular-nums tnum"
      style={{ color }}
      title={`S${sector.index + 1}: ${sectorTime(sector.lastTime)}${
        sector.bestTime != null ? ` (best ${sectorTime(sector.bestTime)})` : ""
      }`}
    >
      {label}
    </span>
  );
}

export { LAP_COLOR };

/* -------------------------------------------------------------------------- */
/*  Class collapse chevron                                                     */
/* -------------------------------------------------------------------------- */

export function CollapseChevron({ collapsed }: { collapsed: boolean }) {
  const Icon = collapsed ? ChevronDown : ChevronUp;
  return <Icon className="size-3.5 text-muted" />;
}
