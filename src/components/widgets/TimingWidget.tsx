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
    <div className="flex h-full flex-col justify-center gap-2">
      {/* Three channels side by side, each a label over its time, divided by
          hairlines rather than boxed. */}
      <div className="grid grid-cols-3 divide-x divide-divider">
        {cells.map(([label, t, color]) => (
          <div key={label} className="flex min-w-0 flex-col gap-1 px-1.5 first:pl-0 last:pr-0">
            <span className="wg-label truncate">{label}</span>
            <span className={`tnum wg-value-sm truncate font-medium ${color}`}>
              {lapTime(t)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex shrink-0 items-baseline justify-between gap-2 border-t border-divider pt-2">
        <span className="wg-label">Δ Lap vs best</span>
        <span
          className="tnum wg-value font-medium"
          style={{ color: deltaColor(delta) }}
        >
          {signedDelta(delta)}
        </span>
      </div>
    </div>
  );
}
