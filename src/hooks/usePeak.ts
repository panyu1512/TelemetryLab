import { useRef } from "react";

/**
 * Track the running maximum of a live value, never below `floor`. Used to
 * self-calibrate a scale (e.g. an RPM redline) when the telemetry doesn't tell
 * us the ceiling. Updating the ref during render is safe here: it's monotonic
 * and produces the same result regardless of render timing.
 */
export function usePeak(value: number | null | undefined, floor = 0): number {
  const peak = useRef(floor);
  if (value != null && Number.isFinite(value) && value > peak.current) {
    peak.current = value;
  }
  return Math.max(peak.current, floor);
}
