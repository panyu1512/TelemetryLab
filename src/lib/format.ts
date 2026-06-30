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
