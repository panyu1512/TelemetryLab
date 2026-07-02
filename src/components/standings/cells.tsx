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
/*  Car-brand SVG icon — monochrome, currentColor                            */
/* -------------------------------------------------------------------------- */

/**
 * Inline SVG renderers for known iRacing manufacturers.
 * All icons use `currentColor` so they inherit the row's text colour and look
 * correct on any background. Each viewBox is tuned so the icon sits naturally
 * at ~11 px tall — the container sets `height: 11px; width: auto`.
 */
const BRAND_ICONS: Record<string, () => JSX.Element> = {
  /* Audi — four interlocking rings */
  Audi: () => (
    <svg viewBox="0 0 30 9" fill="none" stroke="currentColor" strokeWidth="1.1">
      <circle cx="3.5"  cy="4.5" r="3.4"/>
      <circle cx="9.0"  cy="4.5" r="3.4"/>
      <circle cx="14.5" cy="4.5" r="3.4"/>
      <circle cx="20.0" cy="4.5" r="3.4"/>
    </svg>
  ),

  /* BMW — roundel with two opposite filled quadrants */
  BMW: () => (
    <svg viewBox="0 0 11 11" fill="none">
      <circle cx="5.5" cy="5.5" r="4.8" stroke="currentColor" strokeWidth="1"/>
      <path d="M5.5,0.7 A4.8,4.8,0,0,1,10.3,5.5 L5.5,5.5 Z" fill="currentColor"/>
      <path d="M5.5,10.3 A4.8,4.8,0,0,1,0.7,5.5 L5.5,5.5 Z" fill="currentColor"/>
    </svg>
  ),

  /* McLaren — speedmark: two crossing S-curves forming a horizontal lens */
  McLaren: () => (
    <svg viewBox="0 0 20 8" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <path d="M0.5,4 C4,0.5 8,0.5 10,4 C12,7.5 16,7.5 19.5,4"/>
      <path d="M0.5,4 C4,7.5 8,7.5 10,4 C12,0.5 16,0.5 19.5,4"/>
    </svg>
  ),

  /* Mercedes — three-pointed star in circle */
  Mercedes: () => (
    <svg viewBox="0 0 11 11" fill="none">
      <circle cx="5.5" cy="5.5" r="4.8" stroke="currentColor" strokeWidth="1"/>
      {/* Arms at 0°, 120°, 240° from top */}
      <line x1="5.5" y1="5.5" x2="5.5"  y2="0.7"  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="5.5" y1="5.5" x2="9.66" y2="7.9"  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <line x1="5.5" y1="5.5" x2="1.34" y2="7.9"  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  ),

  /* Ferrari — Scuderia shield silhouette */
  Ferrari: () => (
    <svg viewBox="0 0 9 12" fill="none" stroke="currentColor" strokeWidth="1.1">
      <path d="M1,1 H8 V8.5 L4.5,11 L1,8.5 Z"/>
    </svg>
  ),

  /* Porsche — divided crest (shield quartered by cross) */
  Porsche: () => (
    <svg viewBox="0 0 11 13" fill="none" stroke="currentColor" strokeWidth="1.1">
      <path d="M5.5,1 L10,3.5 L10,9.5 L5.5,12 L1,9.5 L1,3.5 Z"/>
      <line x1="5.5" y1="1"   x2="5.5" y2="12"  strokeWidth="1"/>
      <line x1="1"   y1="6.5" x2="10"  y2="6.5"  strokeWidth="1"/>
    </svg>
  ),

  /* Chevrolet — bowtie (two filled hexagons with center gap) */
  Chevrolet: () => (
    <svg viewBox="0 0 20 7" fill="currentColor">
      <path d="M0,1 H7.5 L9.5,3.5 L7.5,6 H0 L2,3.5 Z"/>
      <path d="M20,1 H12.5 L10.5,3.5 L12.5,6 H20 L18,3.5 Z"/>
    </svg>
  ),

  /* Cadillac — shield crest with horizontal divider */
  Cadillac: () => (
    <svg viewBox="0 0 11 13" fill="none" stroke="currentColor" strokeWidth="1.1">
      <path d="M5.5,1 L10,3 L10,10 L5.5,12 L1,10 L1,3 Z"/>
      <line x1="1" y1="6.5" x2="10" y2="6.5"/>
    </svg>
  ),

  /* Ford — the classic oval outline */
  Ford: () => (
    <svg viewBox="0 0 18 11" fill="none" stroke="currentColor" strokeWidth="1.1">
      <ellipse cx="9" cy="5.5" rx="8.2" ry="4.7"/>
    </svg>
  ),

  /* Toyota — three overlapping ellipses forming the T */
  Toyota: () => (
    <svg viewBox="0 0 17 12" fill="none" stroke="currentColor" strokeWidth="1.1">
      <ellipse cx="8.5" cy="6"   rx="7.8" ry="5.3"/>
      <ellipse cx="8.5" cy="6"   rx="3.3" ry="5.3"/>
      <ellipse cx="8.5" cy="4.2" rx="7.8" ry="3"/>
    </svg>
  ),

  /* Honda — H letterform in a shield/pentagon */
  Honda: () => (
    <svg viewBox="0 0 11 12" fill="none" stroke="currentColor" strokeWidth="1.1">
      <path d="M1.5,1 H9.5 V8.5 L5.5,11 L1.5,8.5 Z"/>
      <path d="M3.5,2.5 V9.5 M7.5,2.5 V9.5 M3.5,6 H7.5" strokeWidth="1.3"/>
    </svg>
  ),

  /* Dallara — bold D letterform */
  Dallara: () => (
    <svg viewBox="0 0 9 11" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M2,1 H5 A5,4.5,0,0,1,5,10 H2 Z"/>
    </svg>
  ),

  /* Lamborghini — shield with crossed lines hinting at the charging bull */
  Lamborghini: () => (
    <svg viewBox="0 0 11 13" fill="none" stroke="currentColor" strokeWidth="1.1">
      <path d="M5.5,1 L10,3.5 L10,9.5 L5.5,12 L1,9.5 L1,3.5 Z"/>
      <path d="M2,4.5 L9,8.5"  strokeWidth="1"/>
      <path d="M2,8 L7.5,4.5" strokeWidth="1"/>
    </svg>
  ),

  /* Acura — precision-cut A with horizontal bar */
  Acura: () => (
    <svg viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0.8,10 L5.5,1 L10.2,10"/>
      <line x1="2.8" y1="7.5" x2="8.2" y2="7.5"/>
    </svg>
  ),

  /* Mazda — M-wing / double-arc logo */
  Mazda: () => (
    <svg viewBox="0 0 15 9" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <path d="M0.5,8 C2.5,8 4,1 7.5,1 C11,1 12.5,8 14.5,8"/>
      <path d="M3.5,8 C4.5,8 6,4 7.5,4 C9,4 10.5,8 11.5,8"/>
    </svg>
  ),

  /* Nissan — circle with a horizontal bar running through it */
  Nissan: () => (
    <svg viewBox="0 0 18 9" fill="none" stroke="currentColor" strokeWidth="1.1">
      <line x1="0.5" y1="4.5" x2="17.5" y2="4.5"/>
      <circle cx="9" cy="4.5" r="4"/>
    </svg>
  ),

  /* Hyundai — italic H inside an oval */
  Hyundai: () => (
    <svg viewBox="0 0 15 11" fill="none" stroke="currentColor" strokeWidth="1.1">
      <ellipse cx="7.5" cy="5.5" rx="6.8" ry="4.8"/>
      <path d="M4,3 V8 M11,3 V8 M4,5.5 H11" strokeWidth="1.4"/>
    </svg>
  ),

  /* Subaru — Pleiades star cluster (one large + five smaller) */
  Subaru: () => (
    <svg viewBox="0 0 16 9" fill="currentColor">
      <circle cx="3.8"  cy="4.5" r="2.2"/>
      <circle cx="9"    cy="2.2" r="1.4"/>
      <circle cx="12.5" cy="1.2" r="1.1"/>
      <circle cx="13.5" cy="4.5" r="1.5"/>
      <circle cx="11.5" cy="7.5" r="1.1"/>
      <circle cx="8.5"  cy="7.8" r="1.1"/>
    </svg>
  ),

  /* Volkswagen — stacked V and W letters inside a circle */
  Volkswagen: () => (
    <svg viewBox="0 0 11 11" fill="none">
      <circle cx="5.5" cy="5.5" r="4.8" stroke="currentColor" strokeWidth="1"/>
      <path d="M3.5,2.5 L5.5,6.5 L7.5,2.5"             fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M1.8,5 L3.8,9 L5.5,6.5 L7.2,9 L9.2,5"   fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
    </svg>
  ),

  /* Lotus — L in an ellipse */
  Lotus: () => (
    <svg viewBox="0 0 13 10" fill="none" stroke="currentColor" strokeWidth="1.1">
      <ellipse cx="6.5" cy="5" rx="6" ry="4.3"/>
      <path d="M4.5,2.5 V7.5 H8.5" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),

  /* Radical — R letterform */
  Radical: () => (
    <svg viewBox="0 0 9 11" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <path d="M2,1 V10"/>
      <path d="M2,1 Q7.5,1 7.5,3.5 Q7.5,6 2,6"/>
      <line x1="5" y1="6" x2="8" y2="10"/>
    </svg>
  ),

  /* Skip Barber — simplified S letterform */
  Skip: () => (
    <svg viewBox="0 0 9 11" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <path d="M7.5,2.5 Q7.5,1 5.5,1 Q1.5,1 1.5,3.5 Q1.5,6 7.5,6 Q7.5,8 7.5,9.5 Q7.5,10.5 5.5,10.5 Q1.5,10.5 1.5,9"/>
    </svg>
  ),
};

/* Aliases */
BRAND_ICONS.VW = BRAND_ICONS.Volkswagen;
BRAND_ICONS["Mercedes-AMG"] = BRAND_ICONS.Mercedes;

export function BrandIcon({ make }: { make: string }) {
  if (!make) return null;
  const Icon = BRAND_ICONS[make];
  if (Icon) {
    // .brand-icon CSS rule: > svg { height: 100%; width: auto; display: block; }
    // inline-flex default (align-items: stretch) lets height:100% resolve to 13px.
    return (
      <span
        className="brand-icon shrink-0 inline-flex"
        style={{ height: 13, color: "rgba(230,230,230,0.55)" }}
        title={make}
      >
        <Icon />
      </span>
    );
  }
  // Unknown brand: plain muted pill with first 3 letters.
  return (
    <span
      className="shrink-0 rounded bg-surface-2 px-1 text-[9px] uppercase tracking-wide text-muted"
      title={make}
    >
      {make.slice(0, 3)}
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

/** Tire viewed from the side: thick sidewall ring + rim ring + cross spokes. */
function TireCompoundIcon({ compound }: { compound: number }) {
  const color = COMPOUND_COLOR[compound] ?? "var(--color-muted)";
  return (
    <svg
      viewBox="0 0 14 14"
      style={{ height: 14, width: 14, display: "block", flexShrink: 0 }}
      fill="none"
    >
      {/* Outer tire ring (sidewall / tread) */}
      <circle cx="7" cy="7" r="6" stroke={color} strokeWidth="2.5" strokeOpacity="0.7" />
      {/* Rim */}
      <circle cx="7" cy="7" r="2.8" stroke={color} strokeWidth="1.2" />
      {/* Cross spokes */}
      <line x1="7" y1="4.2" x2="7" y2="9.8" stroke={color} strokeWidth="0.9" strokeOpacity="0.45" />
      <line x1="4.2" y1="7" x2="9.8" y2="7" stroke={color} strokeWidth="0.9" strokeOpacity="0.45" />
    </svg>
  );
}

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
      <TireCompoundIcon compound={compound} />
      <span
        className="text-[9px] font-bold leading-none"
        style={{ color }}
        title={`Compound ${label}`}
      >
        {label}
      </span>
      <span className="text-[9px] tabular-nums" style={{ color: "rgba(136,136,136,0.7)" }} title={`${laps} laps on tyres`}>
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
