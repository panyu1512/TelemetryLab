/** Color scales and delta helpers for telemetry widgets. */

type RGB = [number, number, number];

/**
 * Tyre-temperature heat scale: blue (cold) → green (optimal) → orange → red.
 *
 * Tuned so the realistic operating band (~75–95 °C) actually spans several
 * colors — a wider scale put the whole working range on the same green.
 */
const HEAT_STOPS: Array<[number, RGB]> = [
  [55, [77, 156, 248]], // cold — informational blue
  [78, [47, 214, 127]], // optimal — accent green
  [90, [240, 154, 60]], // hot — orange
  [105, [244, 86, 79]], // overheating — red
];

/** The temperature window the heat scale covers, for normalizing bars. */
export const HEAT_MIN = HEAT_STOPS[0][0];
export const HEAT_MAX = HEAT_STOPS[HEAT_STOPS.length - 1][0];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Map a tyre temperature (°C) to a heat-scale color. Interpolates between the
 * stops so the gradient is smooth; clamps outside the range.
 */
export function heatColor(temp: number | null | undefined): string {
  if (temp == null || Number.isNaN(temp)) return "var(--color-border-strong)";
  if (temp <= HEAT_STOPS[0][0]) return rgb(HEAT_STOPS[0][1]);
  const last = HEAT_STOPS[HEAT_STOPS.length - 1];
  if (temp >= last[0]) return rgb(last[1]);
  for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
    const [t0, c0] = HEAT_STOPS[i];
    const [t1, c1] = HEAT_STOPS[i + 1];
    if (temp >= t0 && temp <= t1) {
      const f = (temp - t0) / (t1 - t0);
      return rgb([
        Math.round(lerp(c0[0], c1[0], f)),
        Math.round(lerp(c0[1], c1[1], f)),
        Math.round(lerp(c0[2], c1[2], f)),
      ]);
    }
  }
  return rgb(last[1]);
}

function rgb([r, g, b]: RGB): string {
  return `rgb(${r} ${g} ${b})`;
}

/** Format a lap delta (seconds) as a signed, fixed-precision string. */
export function signedDelta(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const sign = seconds >= 0 ? "+" : "−";
  return `${sign}${Math.abs(seconds).toFixed(3)}`;
}

/** Token color for a delta: faster = accent, slower = danger, flat = muted. */
export function deltaColor(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "var(--color-muted)";
  if (seconds < -0.001) return "var(--color-accent)";
  if (seconds > 0.001) return "var(--color-danger)";
  return "var(--color-muted)";
}
