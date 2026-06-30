import type { TelemetryData } from "../../hooks/useTelemetry";
import { lapTime } from "../../lib/format";
import { signedDelta, deltaColor } from "../../lib/scales";

const LABEL_FONT = "clamp(0.5rem, 6cqmin, 0.65rem)";
const TIME_FONT = "clamp(0.62rem, 7cqmin, 1.3rem)";
const DELTA_FONT = "clamp(0.85rem, 11cqmin, 1.6rem)";

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
      <div className="grid grid-cols-3 gap-1 text-center">
        {cells.map(([label, t, color]) => (
          <div key={label} className="flex min-w-0 flex-col gap-1">
            <span
              className="truncate uppercase tracking-wider text-muted"
              style={{ fontSize: LABEL_FONT }}
            >
              {label}
            </span>
            <span
              className={`tnum truncate font-semibold ${color}`}
              style={{ fontSize: TIME_FONT }}
            >
              {lapTime(t)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex shrink-0 items-center justify-center gap-2 border-t border-border pt-2">
        <span
          className="uppercase tracking-wider text-muted"
          style={{ fontSize: LABEL_FONT }}
        >
          Δ vs best
        </span>
        <span
          className="tnum font-semibold"
          style={{ fontSize: DELTA_FONT, color: deltaColor(delta) }}
        >
          {signedDelta(delta)}
        </span>
      </div>
    </div>
  );
}
