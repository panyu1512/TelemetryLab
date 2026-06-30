import type { TelemetryData } from "../../hooks/useTelemetry";
import { usePeak } from "../../hooks/usePeak";
import { num, gearLabel } from "../../lib/format";
import { Bar, Gauge } from "./primitives";

const SHIFT_LIGHTS = 8;

function ShiftLights({ frac }: { frac: number }) {
  const lit = Math.round(frac * SHIFT_LIGHTS);
  const atRedline = frac >= 0.97;
  return (
    <div className={`flex items-center gap-1 ${atRedline ? "animate-pulse" : ""}`}>
      {Array.from({ length: SHIFT_LIGHTS }).map((_, i) => {
        const on = i < lit;
        const color =
          i < SHIFT_LIGHTS * 0.6
            ? "var(--color-accent)"
            : i < SHIFT_LIGHTS * 0.85
              ? "var(--color-warning)"
              : "var(--color-danger)";
        return (
          <span
            key={i}
            className="h-1.5 w-3 rounded-sm transition-colors"
            style={{
              background: on ? color : "var(--color-surface-2)",
              boxShadow: on ? `0 0 6px ${color}` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

export function ClusterWidget({ data }: { data: TelemetryData | null }) {
  const redline = usePeak(data?.rpm, 6000);
  const speedMax = Math.max(Math.ceil(usePeak(data?.speedKmh, 80) / 20) * 20, 80);
  const rpmFrac = data?.rpm != null ? data.rpm / redline : 0;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <ShiftLights frac={rpmFrac} />
        <span className="tnum text-sm text-muted">
          <span className="font-semibold text-text">{num(data?.rpm)}</span> rpm
        </span>
      </div>

      <Bar
        value={rpmFrac}
        height={6}
        color="linear-gradient(90deg, var(--color-accent), var(--color-warning) 70%, var(--color-danger))"
      />

      <div className="flex flex-1 items-center justify-around gap-4">
        <Gauge value={data?.speedKmh} max={speedMax} unit="km/h" />
        <div className="flex flex-col items-center">
          <span className="tnum text-6xl font-bold leading-none text-accent">
            {gearLabel(data?.gear)}
          </span>
          <span className="mt-1 text-[10px] uppercase tracking-wider text-muted">
            Gear
          </span>
        </div>
      </div>
    </div>
  );
}
