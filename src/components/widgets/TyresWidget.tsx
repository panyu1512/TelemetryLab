import { useRef } from "react";
import type { TelemetryData, TyreData } from "../../hooks/useTelemetry";
import { duration, num } from "../../lib/format";
import { heatColor, HEAT_MIN, HEAT_MAX } from "../../lib/scales";
import {
  advanceTyreAges,
  allCornersStale,
  heldForMs,
  isCornerStale,
  type TyreAges,
} from "../../lib/tyreFreshness";

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

/**
 * How far a held corner fades. Enough that a glance across the four tells you
 * which are live, not so far that the number stops being readable — a stale
 * temperature is still the best information the driver has about that tyre.
 */
const STALE_OPACITY = 0.5;

function Corner({
  name,
  tyre,
  stale,
}: {
  name: string;
  tyre: TyreData | undefined;
  stale: boolean;
}) {
  const temp = tyre?.tempM;
  // The heat scale is the reading, so it stays — taken a step toward the
  // neutral so it sits in the graphite rather than glowing on it, and carried
  // by the corner's edge and its bar. The figure itself is data, in the data
  // grey.
  const color = `color-mix(in oklab, ${heatColor(temp)} 80%, var(--color-chart-tertiary))`;
  return (
    <div
      // The panels' section tone, a hairline edge, and the heat colour as a
      // 2 px bar down the corner's left.
      className="flex flex-col justify-center overflow-hidden rounded-ctl bg-section px-2.5 py-1.5"
      style={{
        borderLeft: `2px solid ${color}`,
        // Fade the whole corner rather than recolouring the number: the heat
        // colour is the reading, and swapping it for a "stale" grey would throw
        // away the one thing the driver is looking for.
        opacity: stale ? STALE_OPACITY : 1,
        transition: "opacity var(--dur-long) var(--ease-out)",
      }}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className="wg-label">{name}</span>
        <span className="flex items-baseline gap-0.5">
          <span className="tnum wg-value-sm font-medium text-text">
            {num(temp, TEMP_DECIMALS)}
          </span>
          <span className="wg-unit">°C</span>
        </span>
      </div>
      <div className="mt-1.5 h-[3px] shrink-0 overflow-hidden bg-chart-track">
        <div
          className="h-full transition-[width] duration-200 ease-out"
          style={{ width: `${tempFrac(temp) * 100}%`, background: color }}
        />
      </div>
      <span className="wg-small mt-1.5 flex items-baseline gap-1 truncate text-muted">
        <span className="tnum">{num(tyre?.pressure)}</span>
        <span className="wg-unit">kPa cold</span>
      </span>
    </div>
  );
}

/** The "these are your last stop's numbers" strip under the four corners. */
function HeldNote({ heldMs }: { heldMs: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center gap-1.5 rounded-ctl border-l-2 border-warning bg-section px-2 py-1 text-warning"
      title={
        "iRacing only refreshes carcass temperatures in the pit stall for this car, " +
        "so these are the temperatures your tyres had at your last stop."
      }
    >
      <span className="wg-label truncate text-warning">since last stop</span>
      <span className="tnum wg-small">{duration(heldMs / 1000)}</span>
    </div>
  );
}

export function TyresWidget({ data }: { data: TelemetryData | null }) {
  const t = data?.tyres;

  /*
   * Freshness is timed across frames, so it needs somewhere to live between
   * them — and a ref, not state: the telemetry channel runs at 60 Hz and
   * `setState` on every frame would re-render the whole widget a second time
   * for a value that changes twice a stint. Folding the frame in during render
   * is safe here because `advanceTyreAges` is idempotent for a given frame:
   * React's double-invoke under StrictMode lands on the same clocks.
   */
  const agesRef = useRef<TyreAges | null>(null);
  const now = Date.now();
  const ages = advanceTyreAges(agesRef.current, t, now);
  agesRef.current = ages;

  const held = allCornersStale(ages, now);

  return (
    <div className="flex h-full flex-col gap-1.5">
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-1.5">
        <Corner name="LF" tyre={t?.lf} stale={isCornerStale(ages, "lf", now)} />
        <Corner name="RF" tyre={t?.rf} stale={isCornerStale(ages, "rf", now)} />
        <Corner name="LR" tyre={t?.lr} stale={isCornerStale(ages, "lr", now)} />
        <Corner name="RR" tyre={t?.rr} stale={isCornerStale(ages, "rr", now)} />
      </div>
      {held && <HeldNote heldMs={heldForMs(ages, now)} />}
    </div>
  );
}
