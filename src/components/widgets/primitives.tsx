import type { CSSProperties, ReactNode } from "react";

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
 * Fluid font sizes in container-query units: the value tracks the widget's
 * smaller dimension (`cqmin`) so it grows/shrinks with the card, clamped so it
 * never gets unreadably small or absurdly large. Requires an ancestor with
 * `container-type` — the widget body sets it (see Widget.tsx).
 */
const VALUE_FONT: Record<NonNullable<StatTileProps["size"]>, string> = {
  md: "clamp(0.9rem, 13cqmin, 1.6rem)",
  lg: "clamp(1rem, 16cqmin, 2.1rem)",
  xl: "clamp(1.1rem, 20cqmin, 2.8rem)",
};

const LABEL_FONT = "clamp(0.5rem, 6cqmin, 0.65rem)";
const UNIT_FONT = "clamp(0.55rem, 6cqmin, 0.75rem)";

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
    <div className={`flex min-w-0 flex-col gap-0.5 ${ALIGN[align]}`}>
      <div className="flex max-w-full items-baseline gap-1">
        <span
          className={`tnum truncate font-semibold leading-none ${color ? "" : "text-text"}`}
          style={{ fontSize: VALUE_FONT[size], color }}
        >
          {value}
        </span>
        {unit && (
          <span
            className="shrink-0 text-muted"
            style={{ fontSize: UNIT_FONT }}
          >
            {unit}
          </span>
        )}
      </div>
      {label && (
        <span
          className="truncate uppercase tracking-wider text-muted"
          style={{ fontSize: LABEL_FONT }}
        >
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
  className?: string;
}

export function Bar({
  value,
  color = "var(--color-accent)",
  track = "var(--color-surface-2)",
  height = 8,
  className = "",
}: BarProps) {
  const v = Math.max(0, Math.min(1, value ?? 0));
  return (
    <div
      className={`w-full shrink-0 overflow-hidden rounded-full ${className}`}
      style={{ height, background: track }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-100"
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

const GAUGE_VALUE_STYLE: CSSProperties = {
  fontSize: "clamp(0.9rem, 22cqmin, 2.4rem)",
};
const GAUGE_UNIT_STYLE: CSSProperties = {
  fontSize: "clamp(0.45rem, 7cqmin, 0.8rem)",
};

/**
 * Renders into a 0..100 viewBox and fills its parent, so the parent decides the
 * size (give it a square box). The centered readout scales with the widget via
 * container-query units.
 */
export function Gauge({
  value,
  max,
  min = 0,
  thickness = 8,
  unit,
  color = "var(--color-accent)",
  trackColor = "var(--color-surface-2)",
  children,
}: GaugeProps) {
  const frac =
    value == null || max <= min
      ? 0
      : Math.max(0, Math.min(1, (value - min) / (max - min)));
  const c = 50;
  const r = (100 - thickness) / 2;

  return (
    <div className="relative h-full w-full">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
      >
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
            <span
              className="tnum font-semibold leading-none text-text"
              style={GAUGE_VALUE_STYLE}
            >
              {value == null ? "—" : Math.round(value)}
            </span>
            {unit && (
              <span
                className="uppercase tracking-wider text-muted"
                style={GAUGE_UNIT_STYLE}
              >
                {unit}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
