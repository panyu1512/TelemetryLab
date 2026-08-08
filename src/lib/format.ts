/** Small, dependency-free formatters for telemetry values. */

/** Format a number, or render an em dash when null/undefined. */
export function num(
  value: number | null | undefined,
  digits = 0
): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

/** Format a 0..1 fraction as a whole-number percentage. */
export function pct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value * 100)}`;
}

/** iRacing gear: -1 reverse, 0 neutral, 1..n forward. */
export function gearLabel(gear: number | null | undefined): string {
  if (gear == null) return "—";
  if (gear < 0) return "R";
  if (gear === 0) return "N";
  return String(gear);
}

/** Seconds → `m:ss.mmm` lap-time string (or em dash). */
export function lapTime(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0 || Number.isNaN(seconds)) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

/**
 * Gap to leader for the timing screen: seconds (`+3.4`), or a lap count
 * (`+2L`) when the car is one or more laps down.
 */
export function gap(
  value: number | null | undefined,
  isLaps: boolean
): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (isLaps) return value >= 1 ? `+${Math.round(value)}L` : "—";
  if (value <= 0) return "—";
  return `+${value.toFixed(value < 100 ? 1 : 0)}`;
}

/** Interval to the car ahead: `+0.7`, or em dash when not a clean seconds gap. */
export function interval(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value) || value <= 0) return "—";
  return `+${value.toFixed(value < 100 ? 1 : 0)}`;
}

/** Signed delta like `-0.312` / `+0.7` for sector/lap deltas (or em dash). */
export function delta(
  value: number | null | undefined,
  digits = 1
): string {
  if (value == null || Number.isNaN(value)) return "—";
  const s = Math.abs(value).toFixed(digits);
  if (value > 0) return `+${s}`;
  if (value < 0) return `-${s}`;
  return s;
}

/** Short sector time like `23.7` / `1:40.2` (compact for the sector cells). */
export function sectorTime(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0 || Number.isNaN(seconds)) return "—";
  if (seconds < 60) return seconds.toFixed(1);
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

/**
 * Seconds → a wall-style duration: `50:24`, or `1:02:11` once it passes an
 * hour. Used for session time remaining on the timing strip, where the value
 * ticks every second and must not change width as it does — hence the padded
 * minutes above an hour.
 */
export function duration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds) || seconds < 0) return "—";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}

/**
 * Ratings and other four-figure counts in a two-character-mantissa form:
 * `3337` → `3.3k`, `842` → `842`. Keeps SOF and iRating the same width as the
 * other strip fields instead of being the one value that resizes the row.
 */
export function kilo(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value) || value <= 0) return "—";
  if (value < 1000) return String(Math.round(value));
  return `${(value / 1000).toFixed(1)}k`;
}

/** Temperature with a degree sign, e.g. `38°`. */
export function degrees(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Math.round(value)}°`;
}

/** Signed integer with a sign, e.g. `+14` / `-3` / `0` (for iR / positions). */
export function signed(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (value > 0) return `+${value}`;
  return String(value);
}
