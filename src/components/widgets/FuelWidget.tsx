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
    <div className="flex h-full flex-col justify-center gap-2">
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
      <div
        className="flex items-center justify-between gap-1 text-muted"
        style={{ fontSize: "clamp(0.55rem, 6cqmin, 0.75rem)" }}
      >
        <span className="tnum">{pct(data?.fuelLevelPct)}%</span>
        <span className="tnum truncate">
          {perLap == null ? "calibrating…" : `${perLap.toFixed(2)} L/lap`}
        </span>
      </div>
    </div>
  );
}
