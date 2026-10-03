import type { TelemetryData } from "../../hooks/useTelemetry";
import { num } from "../../lib/format";
import { StatTile } from "./primitives";

export function PositionWidget({ data }: { data: TelemetryData | null }) {
  return (
    // Centred in the card like every other widget's read-out, with the two
    // tiles still sharing a baseline. Pinned to the bottom edge, a tall card
    // was mostly empty paper with its numbers sitting on the floor.
    <div className="flex h-full flex-col justify-center">
      <div className="flex items-end justify-between">
        <StatTile
          value={`P${num(data?.playerCarPosition)}`}
          label="Position"
          size="xl"
        />
        <StatTile align="end" value={num(data?.lap)} label="Lap" />
      </div>
    </div>
  );
}
