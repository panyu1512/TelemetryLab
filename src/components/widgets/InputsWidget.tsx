import type { TelemetryData } from "../../hooks/useTelemetry";
import { useInputTrace, type InputSample } from "../../hooks/useInputTrace";
import { num } from "../../lib/format";
import { SteeringWheel } from "../ui/SteeringWheel";

const TRACE_POINTS = 300;

const THROTTLE_FILL = "var(--color-accent)";

/* -------------------------------------------------------------------------- */
/*  Rolling throttle / brake trace                                            */
/* -------------------------------------------------------------------------- */

function tracePoints(
  samples: InputSample[],
  key: keyof InputSample,
  maxPoints: number
): string {
  const n = samples.length;
  if (n === 0) return "";
  // Newest sample pinned to the right edge; older points scroll left.
  return samples
    .map((s, i) => {
      const x = 100 - ((n - 1 - i) / (maxPoints - 1)) * 100;
      const y = 100 - s[key] * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function InputTrace({ samples }: { samples: InputSample[] }) {
  return (
    <div className="relative min-w-0 flex-1 overflow-hidden rounded-md border border-border bg-bg">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        {[25, 50, 75].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="100"
            y2={y}
            stroke="var(--color-border)"
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <polyline
          points={tracePoints(samples, "brake", TRACE_POINTS)}
          fill="none"
          stroke="var(--color-danger)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={tracePoints(samples, "throttle", TRACE_POINTS)}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Vertical input bar (throttle / brake)                                     */
/* -------------------------------------------------------------------------- */

function VBar({
  value,
  label,
  fill,
}: {
  value: number | null | undefined;
  label: string;
  fill: string;
}) {
  const v = Math.max(0, Math.min(1, value ?? 0));
  return (
    <div className="flex w-7 shrink-0 flex-col items-center gap-1">
      <span
        className="tnum font-semibold text-text"
        style={{ fontSize: "clamp(0.5rem, 6cqmin, 0.7rem)" }}
      >
        {Math.round(v * 100)}
      </span>
      <div className="relative w-full flex-1 overflow-hidden rounded-sm bg-surface-2">
        {/* No CSS transition: frames arrive at 30 Hz, which is already smooth,
            and a 75 ms ease on `height` low-passed the very thing this bar
            exists to show — the initial stab at the brake never reached its
            peak before the pedal had started trailing off again. */}
        <div
          className="absolute inset-x-0 bottom-0 rounded-sm"
          style={{ height: `${v * 100}%`, background: fill }}
        />
      </div>
      <span
        className="font-medium uppercase tracking-[0.12em] text-faint"
        style={{ fontSize: "clamp(0.45rem, 5cqmin, 0.6rem)" }}
      >
        {label}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Steering                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The wheel, and the angle beside it.
 *
 * This replaced a linear deflection bar — a fill growing left or right of a
 * centre tick, clamped at ±120°. Two things were wrong with it. It asked the
 * reader to convert a length back into a rotation, on the one surface where
 * there is no attention to spare for converting anything; and the clamp meant
 * that past 120° the bar was pinned, so the fastest and most informative thing
 * a driver's hands ever do — a big catch of oversteer, or winding on lock in a
 * hairpin — showed as no movement at all. The wheel has neither problem: it is
 * the same shape as the thing it reports, and it just keeps turning.
 */
function Steering({ deg }: { deg: number | null | undefined }) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-2">
      <SteeringWheel
        deg={deg}
        size="clamp(1.5rem, 22cqmin, 3rem)"
      />
      <span
        className="tnum text-text"
        style={{ fontSize: "clamp(0.6rem, 7cqmin, 0.9rem)", minWidth: "3em" }}
      >
        {num(deg)}°
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function InputsWidget({ data }: { data: TelemetryData | null }) {
  const trace = useInputTrace(data, TRACE_POINTS);
  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex min-h-0 flex-1 gap-2">
        <InputTrace samples={trace} />
        <VBar value={data?.throttle} label="Thr" fill={THROTTLE_FILL} />
        <VBar value={data?.brake} label="Brk" fill="var(--color-danger)" />
        {/*
          Clutch takes `primary`, not a third status colour. Throttle and brake
          are a matched pair — the two pedals a driver modulates against each
          other, in the accent/danger pairing they carry everywhere else in this
          app — and the clutch is not part of that argument. It is on or it is
          not, for a second or two a lap. `primary` says "a different kind of
          thing" without inventing a hue (§ Two colour systems).

          `clutchPedal`, never `clutch`: the raw channel reads 1.0 with the
          driver's foot nowhere near it (see `telemetry/types.ts`).
        */}
        <VBar
          value={data?.clutchPedal}
          label="Clu"
          fill="var(--color-primary)"
        />
      </div>
      <Steering deg={data?.steeringDeg} />
    </div>
  );
}
