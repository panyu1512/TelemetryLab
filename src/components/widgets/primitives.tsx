import type { ReactNode } from "react";

/* -------------------------------------------------------------------------- */
/*  StatTile — a labelled numeric readout                                     */
/* -------------------------------------------------------------------------- */

interface StatTileProps {
  value: ReactNode;
  label?: string;
  unit?: string;
  align?: "start" | "center" | "end";
  size?: "md" | "lg" | "xl";
  /** Override the value color (defaults to the primary text token). */
  color?: string;
  /** Extra content rendered under the label (e.g. a delta). */
  sub?: ReactNode;
}

/*
 * Fluid type in container-query units: the value tracks the widget's smaller
 * dimension (`cqmin`) so it grows and shrinks with the card, clamped at both
 * ends. The sizes are the `.wg-*` roles in styles.css — one place for every
 * fluid size the widgets use. Requires an ancestor with `container-type`; the
 * widget body sets it (see Widget.tsx).
 */
const VALUE_CLASS: Record<NonNullable<StatTileProps["size"]>, string> = {
  md: "wg-value",
  lg: "wg-value-lg",
  xl: "wg-value-xl",
};

const ALIGN = {
  start: "items-start text-left",
  center: "items-center text-center",
  end: "items-end text-right",
} as const;

/**
 * Channel label over value, value over nothing: the label names the channel
 * in small grey caps, the value is the mono figure, and the unit sits after it
 * a size smaller and a step dimmer — `287 KM/H` reads as one large number with
 * its unit attached, not as two equal words.
 */
export function StatTile({
  value,
  label,
  unit,
  align = "start",
  size = "lg",
  color,
  sub,
}: StatTileProps) {
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${ALIGN[align]}`}>
      {label && <span className="wg-label max-w-full truncate">{label}</span>}
      <div className="flex max-w-full items-baseline gap-1">
        <span
          className={`tnum truncate font-medium ${VALUE_CLASS[size]} ${color ? "" : "text-text"}`}
          style={{ color }}
        >
          {value}
        </span>
        {unit && <span className="wg-unit shrink-0">{unit}</span>}
      </div>
      {sub}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Bar — a horizontal fill bar (0..1)                                         */
/* -------------------------------------------------------------------------- */

interface BarProps {
  value: number | null | undefined;
  /** Any CSS background for the fill (solid color or gradient). */
  color?: string;
  track?: string;
  height?: number;
  className?: string;
}

export function Bar({
  value,
  color = "var(--color-chart-secondary)",
  track = "var(--color-chart-track)",
  height = 4,
  className = "",
}: BarProps) {
  const v = Math.max(0, Math.min(1, value ?? 0));
  // Square ends, not a pill. A rounded cap tapers the last few pixels of the
  // fill, so a bar at 4 % and a bar at 0 % look the same — and these bars carry
  // fuel and revs, where the bottom of the range is the part you are watching.
  // Thin, on a barely-there track, in a neutral unless the caller has a
  // meaning to colour it with.
  return (
    <div
      className={`w-full shrink-0 overflow-hidden ${className}`}
      style={{ height, background: track }}
    >
      <div
        className="h-full transition-[width] duration-100 ease-out"
        style={{ width: `${v * 100}%`, background: color }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Gauge — a 270° radial arc gauge (resolution-independent)                  */
/* -------------------------------------------------------------------------- */

interface GaugeProps {
  value: number | null | undefined;
  max: number;
  min?: number;
  /** Arc stroke width, in the 0..100 viewBox space. */
  thickness?: number;
  unit?: string;
  color?: string;
  trackColor?: string;
  /** Replaces the default centered value (e.g. to show a gear). */
  children?: ReactNode;
}

const GAUGE_START = 225; // bottom-left
const GAUGE_SPAN = 270; // sweep clockwise, leaving a 90° gap at the bottom

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const start = polar(cx, cy, r, a0);
  const end = polar(cx, cy, r, a1);
  const large = (a1 - a0) % 360 > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

/**
 * Renders into a 0..100 viewBox and fills its parent, so the parent decides the
 * size (give it a square box). The centered readout scales with the widget via
 * container-query units.
 */
/** Graduation marks along the arc — what makes it read as an instrument. */
const GAUGE_TICKS = 10;
/** Minor marks between each pair of major ones. */
const GAUGE_MINOR = 4;

export function Gauge({
  value,
  max,
  min = 0,
  thickness = 3,
  unit,
  color = "var(--color-chart-primary)",
  trackColor = "var(--color-chart-grid)",
  children,
}: GaugeProps) {
  const frac =
    value == null || max <= min
      ? 0
      : Math.max(0, Math.min(1, (value - min) / (max - min)));
  const c = 50;
  const r = (100 - thickness) / 2;
  const tickOuter = r - thickness / 2 - 2.5;
  const tickInner = tickOuter - 4;
  const minorInner = tickOuter - 2;
  const minorCount = (GAUGE_TICKS - 1) * GAUGE_MINOR;

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
      >
        {/* Minor graduations, then the major ones over them — hairlines on
            the axis tone, inside the arc. */}
        {Array.from({ length: minorCount + 1 }).map((_, i) => {
          if (i % GAUGE_MINOR === 0) return null;
          const a = GAUGE_START + (GAUGE_SPAN * i) / minorCount;
          const p0 = polar(c, c, minorInner, a);
          const p1 = polar(c, c, tickOuter, a);
          return (
            <line
              key={`m${i}`}
              x1={p0.x}
              y1={p0.y}
              x2={p1.x}
              y2={p1.y}
              stroke="var(--color-chart-grid)"
              strokeWidth={0.6}
            />
          );
        })}
        {Array.from({ length: GAUGE_TICKS }).map((_, i) => {
          const a = GAUGE_START + (GAUGE_SPAN * i) / (GAUGE_TICKS - 1);
          const p0 = polar(c, c, tickInner, a);
          const p1 = polar(c, c, tickOuter, a);
          return (
            <line
              key={i}
              x1={p0.x}
              y1={p0.y}
              x2={p1.x}
              y2={p1.y}
              stroke="var(--color-chart-axis)"
              strokeWidth={0.9}
            />
          );
        })}
        {/* A thin arc on a faint track, square-ended like every bar: the
            fill is the reading, not a decoration around it. */}
        <path
          d={arcPath(c, c, r, GAUGE_START, GAUGE_START + GAUGE_SPAN)}
          fill="none"
          stroke={trackColor}
          strokeWidth={thickness}
          strokeLinecap="butt"
        />
        {frac > 0 && (
          <path
            d={arcPath(c, c, r, GAUGE_START, GAUGE_START + GAUGE_SPAN * frac)}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="butt"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children ?? (
          <>
            <span className="tnum wg-value-xl font-medium text-text">
              {value == null ? "—" : Math.round(value)}
            </span>
            {unit && <span className="wg-unit mt-1">{unit}</span>}
          </>
        )}
      </div>
    </div>
  );
}
