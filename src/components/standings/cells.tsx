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
/*  Car-brand icon — color-coded pill with manufacturer abbreviation          */
/* -------------------------------------------------------------------------- */

/**
 * Brand color + 3-letter abbreviation for known iRacing manufacturers.
 * Background is the brand's primary hue at low opacity; text is the hue at
 * full saturation so it stays readable on the dark surface.
 */
const BRAND_META: Record<string, { abbr: string; color: string }> = {
  Acura:         { abbr: "ACU", color: "#e05050" },
  Audi:          { abbr: "AUD", color: "#dd2233" },
  BMW:           { abbr: "BMW", color: "#2288cc" },
  Cadillac:      { abbr: "CAD", color: "#b09060" },
  Chevrolet:     { abbr: "CHE", color: "#d4a820" },
  Dallara:       { abbr: "DAL", color: "#4477cc" },
  Ferrari:       { abbr: "FER", color: "#ee1122" },
  Ford:          { abbr: "FOR", color: "#3366cc" },
  Honda:         { abbr: "HON", color: "#cc2222" },
  Hyundai:       { abbr: "HYU", color: "#4466aa" },
  Lamborghini:   { abbr: "LAM", color: "#ccaa22" },
  Lotus:         { abbr: "LOT", color: "#22aa55" },
  Mazda:         { abbr: "MAZ", color: "#aa2222" },
  McLaren:       { abbr: "MCL", color: "#ee8811" },
  Mercedes:      { abbr: "MB",  color: "#22bbaa" },
  "Mercedes-AMG":{ abbr: "AMG", color: "#22bbaa" },
  Nissan:        { abbr: "NIS", color: "#cc2222" },
  Porsche:       { abbr: "POR", color: "#aa9955" },
  Radical:       { abbr: "RAD", color: "#9944cc" },
  Skip:          { abbr: "SKB", color: "#cc5522" },
  Subaru:        { abbr: "SUB", color: "#3355cc" },
  Toyota:        { abbr: "TOY", color: "#ee1133" },
  Volkswagen:    { abbr: "VW",  color: "#3355aa" },
  VW:            { abbr: "VW",  color: "#3355aa" },
};

export function BrandIcon({ make }: { make: string }) {
  if (!make) return null;
  const meta = BRAND_META[make];
  if (!meta) {
    // Unknown brand: plain muted pill with first 3 letters.
    return (
      <span className="shrink-0 rounded bg-surface-2 px-1 text-[9px] uppercase tracking-wide text-muted">
        {make.slice(0, 3)}
      </span>
    );
  }
  return (
    <span
      className="shrink-0 rounded px-1 text-[9px] font-bold uppercase tracking-wide"
      style={{
        background: `${meta.color}22`,
        color: meta.color,
        border: `1px solid ${meta.color}44`,
      }}
      title={make}
    >
      {meta.abbr}
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

/* -------------------------------------------------------------------------- */
/*  Tyre compound + age cell                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Compound label + laps-on-tyre indicator.
 *
 * iRacing uses 0 for the primary compound and 1 for the alternate in most
 * series; higher values appear in series with three or more compounds.
 * We label them P/A/B/… rather than hard-coding "soft/medium/hard" because
 * compound naming varies by series.
 */
const COMPOUND_LABEL: Record<number, string> = { 0: "P", 1: "A", 2: "B", 3: "C" };
const COMPOUND_COLOR: Record<number, string> = {
  0: "var(--color-accent)",
  1: "var(--color-warning)",
  2: "var(--color-danger)",
  3: "var(--color-sector-purple)",
};

export function TireCell({
  compound,
  laps,
}: {
  compound: number | null;
  laps: number;
}) {
  if (compound == null) {
    return <span className="text-center text-[10px] text-muted/30">·</span>;
  }
  const label = COMPOUND_LABEL[compound] ?? String(compound);
  const color = COMPOUND_COLOR[compound] ?? "var(--color-muted)";
  return (
    <div className="flex items-center justify-center gap-0.5">
      <span
        className="rounded px-0.5 text-[9px] font-bold leading-tight"
        style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
        title={`Compound ${label}`}
      >
        {label}
      </span>
      <span className="text-[9px] tabular-nums text-muted/60" title={`${laps} laps on tyres`}>
        {laps}
      </span>
    </div>
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
