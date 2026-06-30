import type { TelemetryData, TyreData } from "../../hooks/useTelemetry";
import { num } from "../../lib/format";
import { heatColor } from "../../lib/scales";

/** Normalize a tyre temp to 0..1 across the heat-scale range for the mini bar. */
function tempFrac(temp: number | null | undefined): number {
  if (temp == null) return 0;
  return Math.max(0, Math.min(1, (temp - 40) / (110 - 40)));
}

function Corner({ name, tyre }: { name: string; tyre: TyreData | undefined }) {
  const temp = tyre?.tempM;
  const color = heatColor(temp);
  return (
    <div className="flex flex-col justify-center rounded-md bg-surface-2 px-3 py-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted">
          {name}
        </span>
        <span className="tnum text-lg font-semibold" style={{ color }}>
          {num(temp)}°
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{ width: `${tempFrac(temp) * 100}%`, background: color }}
        />
      </div>
      <span className="tnum mt-1 text-[10px] text-muted">
        {num(tyre?.pressure)} kPa
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
