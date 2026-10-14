import type { TelemetryData } from "../../hooks/useTelemetry";
import { useFuelEstimate } from "../../hooks/useFuelEstimate";
import { num, pct } from "../../lib/format";
import { Bar, StatTile } from "./primitives";

export function FuelWidget({ data }: { data: TelemetryData | null }) {
  const { perLap, lapsLeft } = useFuelEstimate(data);

  const lapsColor =
    lapsLeft == null
      ? "var(--color-muted)"
      : lapsLeft < 3
        ? "var(--color-danger)"
        : lapsLeft < 5
          ? "var(--color-warning)"
          : "var(--color-text)";

  return (
    <div className="flex h-full flex-col justify-center gap-1.5">
      <div className="flex items-start justify-between">
        <StatTile value={num(data?.fuelLevel, 1)} unit="L" label="In tank" />
        <StatTile
          align="end"
          value={lapsLeft == null ? "—" : lapsLeft.toFixed(1)}
          unit="laps"
          label="Fuel left"
          color={lapsColor}
        />
      </div>
      <Bar value={data?.fuelLevelPct} />
      <div className="wg-small flex items-baseline justify-between gap-1 text-muted">
        <span className="tnum">{pct(data?.fuelLevelPct)}%</span>
        {perLap == null ? (
          <span className="truncate text-faint">calibrating…</span>
        ) : (
          <span className="flex items-baseline gap-1 truncate">
            <span className="tnum">{perLap.toFixed(2)}</span>
            <span className="wg-unit">L/lap</span>
          </span>
        )}
      </div>
    </div>
  );
}
