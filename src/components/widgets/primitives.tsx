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

const VALUE_SIZE = {
  md: "text-2xl",
  lg: "text-3xl",
  xl: "text-4xl",
} as const;

const ALIGN = {
  start: "items-start text-left",
  center: "items-center text-center",
  end: "items-end text-right",
} as const;

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
    <div className={`flex flex-col gap-0.5 ${ALIGN[align]}`}>
      <div className="flex items-baseline gap-1">
        <span
          className={`tnum ${VALUE_SIZE[size]} font-semibold leading-none ${color ? "" : "text-text"}`}
          style={color ? { color } : undefined}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-muted">{unit}</span>}
      </div>
      {label && (
        <span className="text-[10px] uppercase tracking-wider text-muted">
          {label}
        </span>
      )}
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
  /** Anchor the fill to the right edge instead of the left. */
  fromRight?: boolean;
  className?: string;
}

export function Bar({
  value,
  color = "var(--color-accent)",
  track = "var(--color-surface-2)",
  height = 8,
  fromRight = false,
  className = "",
}: BarProps) {
  const v = Math.max(0, Math.min(1, value ?? 0));
  return (
    <div
      className={`w-full overflow-hidden rounded-full ${className}`}
      style={{ height, background: track }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-100"
        style={{
          width: `${v * 100}%`,
          background: color,
          marginLeft: fromRight ? "auto" : undefined,
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Gauge — a 270° radial arc gauge                                           */
/* -------------------------------------------------------------------------- */

interface GaugeProps {
  value: number | null | undefined;
  max: number;
  min?: number;
  size?: number;
  thickness?: number;
  unit?: string;
  label?: string;
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

export function Gauge({
  value,
  max,
  min = 0,
  size = 116,
  thickness = 9,
  unit,
  label,
  color = "var(--color-accent)",
  trackColor = "var(--color-surface-2)",
  children,
}: GaugeProps) {
  const frac =
    value == null || max <= min
      ? 0
      : Math.max(0, Math.min(1, (value - min) / (max - min)));
  const r = (size - thickness) / 2;
  const c = size / 2;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="block">
        <path
          d={arcPath(c, c, r, GAUGE_START, GAUGE_START + GAUGE_SPAN)}
          fill="none"
          stroke={trackColor}
          strokeWidth={thickness}
          strokeLinecap="round"
        />
        {frac > 0 && (
          <path
            d={arcPath(c, c, r, GAUGE_START, GAUGE_START + GAUGE_SPAN * frac)}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children ?? (
          <>
            <span className="tnum text-2xl font-semibold leading-none text-text">
              {value == null ? "—" : Math.round(value)}
            </span>
            {unit && (
              <span className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">
                {unit}
              </span>
            )}
          </>
        )}
      </div>
      {label && (
        <span className="absolute inset-x-0 bottom-0 text-center text-[10px] uppercase tracking-wider text-muted">
          {label}
        </span>
      )}
    </div>
  );
}
