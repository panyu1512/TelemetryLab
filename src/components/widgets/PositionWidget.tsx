import type { TelemetryData } from "../../hooks/useTelemetry";
import { num } from "../../lib/format";
import { StatTile } from "./primitives";

export function PositionWidget({ data }: { data: TelemetryData | null }) {
  return (
    <div className="flex h-full items-end justify-between">
      <StatTile
        value={`P${num(data?.playerCarPosition)}`}
        label="Position"
        size="xl"
      />
      <StatTile align="end" value={num(data?.lap)} label="Lap" />
    </div>
  );
}
