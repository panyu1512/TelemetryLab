import type { TelemetryData } from "../../hooks/useTelemetry";
import { lapTime } from "../../lib/format";
import { signedDelta, deltaColor } from "../../lib/scales";

export function TimingWidget({ data }: { data: TelemetryData | null }) {
  const last = data?.lapLastLapTime ?? null;
  const best = data?.lapBestLapTime ?? null;
  const delta = last != null && best != null && best > 0 ? last - best : null;

  const cells: Array<[string, number | null, string]> = [
    ["Last", last, "text-text"],
    ["Best", best, "text-accent"],
    ["Current", data?.lapCurrentLapTime ?? null, "text-text"],
  ];

  return (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        {cells.map(([label, t, color]) => (
          <div key={label} className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wider text-muted">
              {label}
            </span>
            <span className={`tnum text-sm font-semibold ${color}`}>
              {lapTime(t)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 border-t border-border pt-2">
        <span className="text-[10px] uppercase tracking-wider text-muted">
          Δ vs best
        </span>
        <span
          className="tnum text-lg font-semibold"
          style={{ color: deltaColor(delta) }}
        >
          {signedDelta(delta)}
        </span>
      </div>
    </div>
  );
}
