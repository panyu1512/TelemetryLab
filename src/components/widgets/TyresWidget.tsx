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
  const color = heatColor(temp);
  return (
    <div
      className="flex flex-col justify-center overflow-hidden rounded-md bg-surface-2 px-2.5 py-1.5"
      style={{
        borderLeft: `3px solid ${color}`,
        // Fade the whole corner rather than recolouring the number: the heat
        // colour is the reading, and swapping it for a "stale" grey would throw
        // away the one thing the driver is looking for.
        opacity: stale ? STALE_OPACITY : 1,
        transition: "opacity 300ms",
      }}
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

/** The "these are your last stop's numbers" strip under the four corners. */
function HeldNote({ heldMs }: { heldMs: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-warning/15 px-2 py-1 text-warning"
      title={
        "iRacing only refreshes carcass temperatures in the pit stall for this car, " +
        "so these are the temperatures your tyres had at your last stop."
      }
    >
      <span
        className="truncate font-medium uppercase tracking-[0.12em]"
        style={{ fontSize: "clamp(0.45rem, 4cqmin, 0.6rem)" }}
      >
        since last stop
      </span>
      <span
        className="tnum"
        style={{ fontSize: "clamp(0.45rem, 4cqmin, 0.6rem)" }}
      >
        {duration(heldMs / 1000)}
      </span>
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
      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2">
        <Corner name="LF" tyre={t?.lf} stale={isCornerStale(ages, "lf", now)} />
        <Corner name="RF" tyre={t?.rf} stale={isCornerStale(ages, "rf", now)} />
        <Corner name="LR" tyre={t?.lr} stale={isCornerStale(ages, "lr", now)} />
        <Corner name="RR" tyre={t?.rr} stale={isCornerStale(ages, "rr", now)} />
      </div>
      {held && <HeldNote heldMs={heldForMs(ages, now)} />}
    </div>
  );
}
