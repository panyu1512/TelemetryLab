import type { TelemetryData } from "../../hooks/useTelemetry";
import { usePeak } from "../../hooks/usePeak";
import { num, gearLabel } from "../../lib/format";
import { Bar, Gauge } from "./primitives";

const SHIFT_LIGHTS = 8;

/**
 * The rev strip: a segmented bar, neutral until the shift zone.
 *
 * It was a row of round LEDs, copying the wheel display it stands in for. The
 * segments are the better read at the size this actually gets drawn: a bar of
 * hard-edged blocks reads as a length, and length is answered without
 * counting. Segments are full-height and share the strip's width, so the bar
 * grows and shrinks with the card.
 *
 * Colour only where it carries meaning: the working range lights in the
 * neutral data tone, the approach to the limiter in `warning`, the limiter in
 * `danger`. No glow on a lit segment — a hard block on a dark track is
 * already the brightest thing on the card. At the limiter the strip pulses,
 * shallow and quick, rather than blinking.
 */
function ShiftLights({ frac }: { frac: number }) {
  const lit = Math.round(frac * SHIFT_LIGHTS);
  const atRedline = frac >= 0.97;
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-[2px] ${atRedline ? "redline-pulse" : ""}`}
      style={{ maxWidth: "55%" }}
    >
      {Array.from({ length: SHIFT_LIGHTS }).map((_, i) => {
        const on = i < lit;
        const color =
          i < SHIFT_LIGHTS * 0.6
            ? "var(--color-chart-secondary)"
            : i < SHIFT_LIGHTS * 0.85
              ? "var(--color-warning)"
              : "var(--color-danger)";
        return (
          <span
            key={i}
            className="min-w-0 flex-1 transition-colors"
            style={{
              height: "clamp(5px, 7cqmin, 8px)",
              background: on ? color : "var(--color-chart-track)",
            }}
          />
        );
      })}
    </div>
  );
}

export function ClusterWidget({ data }: { data: TelemetryData | null }) {
  const redline = usePeak(data?.rpm, 6000);
  const speedMax = Math.max(Math.ceil(usePeak(data?.speedKmh, 80) / 20) * 20, 80);
  const rpmFrac = data?.rpm != null ? data.rpm / redline : 0;

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <ShiftLights frac={rpmFrac} />
        <span className="flex shrink-0 items-baseline gap-1">
          <span className="tnum wg-value-sm font-medium text-text">{num(data?.rpm)}</span>
          <span className="wg-unit">rpm</span>
        </span>
      </div>

      <Bar
        value={rpmFrac}
        height={3}
        color={
          rpmFrac >= 0.95
            ? "var(--color-danger)"
            : rpmFrac >= 0.85
              ? "var(--color-warning)"
              : "var(--color-chart-primary)"
        }
      />

      <div className="flex min-h-0 flex-1 items-center justify-around gap-2">
        <div className="h-full max-w-[48%] flex-1">
          <Gauge value={data?.speedKmh} max={speedMax} unit="km/h" />
        </div>
        {/* The gear: the largest figure on the card, in the mono, with its
            label above it like every other channel. */}
        <div className="flex shrink-0 flex-col items-center gap-1.5">
          <span className="wg-label">Gear</span>
          <span
            className="tnum font-medium leading-none text-text"
            style={{ fontSize: "clamp(1.5rem, 38cqh, 4.5rem)" }}
          >
            {gearLabel(data?.gear)}
          </span>
        </div>
      </div>
    </div>
  );
}
