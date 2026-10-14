import type { TelemetryData } from "../../hooks/useTelemetry";
import { useInputTrace, type InputSample } from "../../hooks/useInputTrace";
import { num } from "../../lib/format";
import { SteeringWheel } from "../ui/SteeringWheel";

const TRACE_POINTS = 300;

/*
 * A reduced chart palette: throttle is the primary channel and takes the
 * accent; brake is the secondary channel in the light neutral; clutch, the
 * channel a driver touches twice a lap, is the tertiary neutral. No status
 * colour — a pedal position is not a gain or a loss.
 */
const THROTTLE_FILL = "var(--color-chart-primary)";
const BRAKE_FILL = "var(--color-chart-secondary)";
const CLUTCH_FILL = "var(--color-chart-tertiary)";

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
  const last = samples[samples.length - 1];
  return (
    <div className="relative min-w-0 flex-1 overflow-hidden border border-divider">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        {/* A faint dotted grid: quarters of travel across, quarters of the
            window down. Hairlines in screen px whatever the box's size. */}
        {[25, 50, 75].map((y) => (
          <line
            key={`h${y}`}
            x1="0"
            y1={y}
            x2="100"
            y2={y}
            stroke="var(--color-chart-grid)"
            style={{ strokeWidth: "var(--chart-line-thin)" }}
            strokeDasharray="1 3"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {[25, 50, 75].map((x) => (
          <line
            key={`v${x}`}
            x1={x}
            y1="0"
            x2={x}
            y2="100"
            stroke="var(--color-chart-grid)"
            style={{ strokeWidth: "var(--chart-line-thin)" }}
            strokeDasharray="1 3"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <polyline
          points={tracePoints(samples, "brake", TRACE_POINTS)}
          fill="none"
          stroke={BRAKE_FILL}
          style={{ strokeWidth: "var(--chart-line)" }}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={tracePoints(samples, "throttle", TRACE_POINTS)}
          fill="none"
          stroke={THROTTLE_FILL}
          style={{ strokeWidth: "var(--chart-line)" }}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* The live cursor: a hairline at "now", the trace's right edge,
            where the newest sample is drawn. */}
        <line
          x1="100"
          y1="0"
          x2="100"
          y2="100"
          stroke="var(--color-chart-axis)"
          style={{ strokeWidth: "var(--chart-line-thin)" }}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* Where each channel meets the cursor: a small square in its colour,
          so the live value is findable at the edge of a busy trace. Drawn in
          HTML so it stays square in a stretched viewBox. */}
      {last && (
        <>
          <span
            aria-hidden
            className="absolute right-0 size-[5px] -translate-y-1/2 translate-x-1/2"
            style={{ top: `${100 - last.brake * 100}%`, background: BRAKE_FILL }}
          />
          <span
            aria-hidden
            className="absolute right-0 size-[5px] -translate-y-1/2 translate-x-1/2"
            style={{ top: `${100 - last.throttle * 100}%`, background: THROTTLE_FILL }}
          />
        </>
      )}
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
    <div className="flex w-6 shrink-0 flex-col items-center gap-1">
      <span className="tnum wg-small font-medium text-text">
        {Math.round(v * 100)}
      </span>
      <div className="relative w-full flex-1 overflow-hidden bg-chart-track">
        {/* No CSS transition: frames arrive at 30 Hz, which is already smooth,
            and a 75 ms ease on `height` low-passed the very thing this bar
            exists to show — the initial stab at the brake never reached its
            peak before the pedal had started trailing off again. */}
        <div
          className="absolute inset-x-0 bottom-0"
          style={{ height: `${v * 100}%`, background: fill }}
        />
      </div>
      <span className="wg-label">{label}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Steering                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The wheel column, sitting to the right of the pedals as a fourth input.
 *
 * It obeys the bars' own three-part grammar — value on top, the thing itself in
 * the middle, label underneath — so the row reads as one instrument rather than
 * as three bars with a graphic bolted on the end. That grammar is the reason it
 * earns the width: it is not decoration beside the pedals, it is the fourth
 * thing the driver is doing with their hands and feet, in the same voice.
 *
 * This replaced a linear deflection bar across the foot of the widget. Two
 * things were wrong with it. It asked the reader to convert a length back into
 * a rotation, on the one surface where there is no attention to spare for
 * converting anything; and the clamp at ±120° meant that past that the bar was
 * pinned, so the fastest and most informative thing a driver's hands ever do —
 * a big catch of oversteer, or winding on lock in a hairpin — showed as no
 * movement at all. The wheel has neither problem: it is the same shape as the
 * thing it reports, and it just keeps turning.
 *
 * The box is square because the artwork *sweeps* a square as it rotates, even
 * though the wheel is wider than it is tall standing still. Sizing the box to
 * the visible ink would clip the rim at a quarter turn.
 */
function SteeringColumn({ deg }: { deg: number | null | undefined }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <span className="tnum wg-small font-medium text-text">{num(deg)}°</span>
      {/* Centred in the column's height, the way a bar's fill is anchored in
          its track — the wheel is the column's body, not a header for it. */}
      <div className="flex min-h-0 flex-1 items-center">
        {/* The wheel in the label grey: a silhouette that turns, not a
            white graphic competing with the figures beside it. */}
        <span className="text-chart-secondary">
          <SteeringWheel deg={deg} size="clamp(2.5rem, 58cqmin, 7rem)" />
        </span>
      </div>
      <span className="wg-label">Steer</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function InputsWidget({ data }: { data: TelemetryData | null }) {
  const trace = useInputTrace(data, TRACE_POINTS);
  // One row, not two. Folding steering into the pedal row gives the trace back
  // the height the old full-width steering strip was taking from it.
  return (
    <div className="flex h-full gap-2">
      <InputTrace samples={trace} />
      <VBar value={data?.throttle} label="Thr" fill={THROTTLE_FILL} />
      <VBar value={data?.brake} label="Brk" fill={BRAKE_FILL} />
      {/*
        Clutch is the tertiary channel: on or off for a second or two a lap,
        so it takes the quiet neutral rather than a hue of its own.

        `clutchPedal`, never `clutch`: the raw channel reads 1.0 with the
        driver's foot nowhere near it (see `telemetry/types.ts`).
      */}
      <VBar value={data?.clutchPedal} label="Clu" fill={CLUTCH_FILL} />
      <SteeringColumn deg={data?.steeringDeg} />
    </div>
  );
}
