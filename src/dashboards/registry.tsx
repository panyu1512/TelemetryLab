import type { ReactNode } from "react";
import {
  Gauge,
  SlidersHorizontal,
  Fuel,
  Timer,
  Donut,
  Flag,
  ListOrdered,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { TelemetryData } from "../hooks/useTelemetry";
import { num, pct, gearLabel, lapTime } from "../lib/format";

/** Relative footprint of a widget on the 12-column dashboard grid. */
export type WidgetSize = "sm" | "md" | "lg" | "xl";

export interface WidgetDef {
  id: string;
  title: string;
  /** One-line purpose, shown in the overlay manager. */
  description: string;
  icon: LucideIcon;
  defaultSize: WidgetSize;
  /** Live preview body. Polished Gauge/Bar primitives land in v0.2. */
  body: (data: TelemetryData | null) => ReactNode;
}

export interface DashboardDef {
  id: string;
  label: string;
  icon: LucideIcon;
  /** False ⇒ planned but not built yet; renders a "coming soon" placeholder. */
  available: boolean;
  /** Roadmap milestone that ships this screen (for the placeholder copy). */
  milestone?: string;
  widgets: WidgetDef[];
}

/* --- tiny presentational helpers (placeholder bodies) --------------------- */

function Metric({
  value,
  unit,
  label,
}: {
  value: ReactNode;
  unit?: string;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-1">
        <span className="tnum text-3xl font-semibold leading-none text-text">
          {value}
        </span>
        {unit && <span className="text-xs text-muted">{unit}</span>}
      </div>
      {label && (
        <span className="text-[10px] uppercase tracking-wider text-muted">
          {label}
        </span>
      )}
    </div>
  );
}

function Bar({
  value,
  color = "var(--color-accent)",
}: {
  value: number | null | undefined;
  color?: string;
}) {
  const v = Math.max(0, Math.min(1, value ?? 0));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div
        className="h-full rounded-full transition-[width] duration-100"
        style={{ width: `${v * 100}%`, background: color }}
      />
    </div>
  );
}

/* --- dashboards ----------------------------------------------------------- */

export const DASHBOARDS: DashboardDef[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: Gauge,
    available: true,
    widgets: [
      {
        id: "cluster",
        title: "Speed · RPM · Gear",
        description: "Primary driving cluster with gear and engine speed.",
        icon: Gauge,
        defaultSize: "lg",
        body: (d) => (
          <div className="flex h-full items-end justify-between gap-4">
            <Metric value={num(d?.speedKmh)} unit="km/h" label="Speed" />
            <div className="tnum text-6xl font-bold leading-none text-accent">
              {gearLabel(d?.gear)}
            </div>
            <Metric value={num(d?.rpm)} unit="rpm" label="Engine" />
          </div>
        ),
      },
      {
        id: "inputs",
        title: "Inputs",
        description: "Throttle, brake and steering trace.",
        icon: SlidersHorizontal,
        defaultSize: "md",
        body: (d) => (
          <div className="flex h-full flex-col justify-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-14 text-[10px] uppercase tracking-wider text-muted">
                Throttle
              </span>
              <Bar value={d?.throttle} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-14 text-[10px] uppercase tracking-wider text-muted">
                Brake
              </span>
              <Bar value={d?.brake} color="var(--color-danger)" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-14 text-[10px] uppercase tracking-wider text-muted">
                Steering
              </span>
              <span className="tnum text-sm text-text">
                {num(d?.steeringDeg)}°
              </span>
            </div>
          </div>
        ),
      },
      {
        id: "fuel",
        title: "Fuel",
        description: "Tank level, percentage and laps remaining.",
        icon: Fuel,
        defaultSize: "sm",
        body: (d) => (
          <div className="flex h-full flex-col justify-center gap-2">
            <Metric value={num(d?.fuelLevel, 1)} unit="L" label="In tank" />
            <Bar value={d?.fuelLevelPct} />
            <span className="tnum text-xs text-muted">
              {pct(d?.fuelLevelPct)}%
            </span>
          </div>
        ),
      },
      {
        id: "timing",
        title: "Lap timing",
        description: "Current, last and best lap with delta.",
        icon: Timer,
        defaultSize: "md",
        body: (d) => (
          <div className="grid h-full grid-cols-3 items-center gap-2 text-center">
            {(
              [
                ["Last", d?.lapLastLapTime],
                ["Best", d?.lapBestLapTime],
                ["Current", d?.lapCurrentLapTime],
              ] as const
            ).map(([label, t]) => (
              <div key={label} className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wider text-muted">
                  {label}
                </span>
                <span className="tnum text-sm font-semibold text-text">
                  {lapTime(t)}
                </span>
              </div>
            ))}
          </div>
        ),
      },
      {
        id: "tyres",
        title: "Tyre temps",
        description: "Per-corner carcass temperatures and pressures.",
        icon: Donut,
        defaultSize: "md",
        body: (d) => {
          const corners = [
            ["LF", d?.tyres.lf.tempM],
            ["RF", d?.tyres.rf.tempM],
            ["LR", d?.tyres.lr.tempM],
            ["RR", d?.tyres.rr.tempM],
          ] as const;
          return (
            <div className="grid h-full grid-cols-2 grid-rows-2 gap-2">
              {corners.map(([name, t]) => (
                <div
                  key={name}
                  className="flex items-center justify-between rounded-md bg-surface-2 px-3"
                >
                  <span className="text-[10px] uppercase text-muted">
                    {name}
                  </span>
                  <span className="tnum text-sm text-text">
                    {num(t)}°
                  </span>
                </div>
              ))}
            </div>
          );
        },
      },
      {
        id: "position",
        title: "Position",
        description: "Race position and current lap.",
        icon: Flag,
        defaultSize: "sm",
        body: (d) => (
          <div className="flex h-full items-end justify-between">
            <Metric value={`P${num(d?.playerCarPosition)}`} label="Position" />
            <Metric value={num(d?.lap)} label="Lap" />
          </div>
        ),
      },
    ],
  },
  {
    id: "standings",
    label: "Standings",
    icon: ListOrdered,
    available: false,
    milestone: "v0.4.0",
    widgets: [],
  },
  {
    id: "relative",
    label: "Relative",
    icon: Users,
    available: false,
    milestone: "v0.5.0",
    widgets: [],
  },
];

export function getDashboard(id: string): DashboardDef {
  return DASHBOARDS.find((d) => d.id === id) ?? DASHBOARDS[0];
}
