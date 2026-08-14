import type { TelemetryData, TyreData } from "../../hooks/useTelemetry";
import { num } from "../../lib/format";
import { heatColor, HEAT_MIN, HEAT_MAX } from "../../lib/scales";

/**
 * Decimals on the temperature readout.
 *
 * Carcass temperature has a lot of thermal mass behind it: it drifts by a
 * fraction of a degree per second, not by whole degrees. Rounded to a whole
 * number the readout sat on the same digits for a minute at a time and the
 * widget looked dead next to speed and the pedal traces — the corners *were*
 * updating every frame, the format was just too coarse to show it. One decimal
 * is the resolution the quantity actually moves at.
 */
const TEMP_DECIMALS = 1;

/** Normalize a tyre temp to 0..1 across the heat-scale range for the mini bar. */
function tempFrac(temp: number | null | undefined): number {
  if (temp == null) return 0;
  return Math.max(0, Math.min(1, (temp - HEAT_MIN) / (HEAT_MAX - HEAT_MIN)));
}

function Corner({ name, tyre }: { name: string; tyre: TyreData | undefined }) {
  const temp = tyre?.tempM;
  const color = heatColor(temp);
  return (
    <div
      className="flex flex-col justify-center overflow-hidden rounded-md bg-surface-2 px-2.5 py-1.5"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span
          className="font-medium uppercase tracking-[0.12em] text-faint"
          style={{ fontSize: "clamp(0.5rem, 5cqmin, 0.65rem)" }}
        >
          {name}
        </span>
        <span
          className="tnum font-semibold"
          style={{ fontSize: "clamp(0.8rem, 9cqmin, 1.2rem)", color }}
        >
          {num(temp, TEMP_DECIMALS)}°
        </span>
      </div>
      <div className="mt-1 h-1 shrink-0 overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{ width: `${tempFrac(temp) * 100}%`, background: color }}
        />
      </div>
      <span
        className="tnum mt-1 truncate text-muted"
        style={{ fontSize: "clamp(0.45rem, 5cqmin, 0.65rem)" }}
      >
        {num(tyre?.pressure)} kPa cold
      </span>
    </div>
  );
}

export function TyresWidget({ data }: { data: TelemetryData | null }) {
  const t = data?.tyres;
  return (
    <div className="grid h-full grid-cols-2 grid-rows-2 gap-2">
      <Corner name="LF" tyre={t?.lf} />
      <Corner name="RF" tyre={t?.rf} />
      <Corner name="LR" tyre={t?.lr} />
      <Corner name="RR" tyre={t?.rr} />
    </div>
  );
}
