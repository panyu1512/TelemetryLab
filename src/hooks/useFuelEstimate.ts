import { useEffect, useRef, useState } from "react";
import type { TelemetryData } from "./useTelemetry";

export interface FuelEstimate {
  /** Average litres burned per lap over the last few completed laps. */
  perLap: number | null;
  /** Whole laps of fuel remaining at the current burn rate. */
  lapsLeft: number | null;
}

const MAX_SAMPLES = 5;

/**
 * Estimate fuel consumption per lap and laps remaining.
 *
 * The bridge doesn't publish a per-lap burn, so we sample the tank level at
 * each lap boundary (when `lap` increments) and average the deltas. Refuels /
 * session resets (fuel jumping up, or the lap counter going backwards) are
 * ignored rather than poisoning the average. `lapsLeft` recomputes live against
 * the current tank so it ticks down within a lap.
 */
export function useFuelEstimate(data: TelemetryData | null): FuelEstimate {
  const state = useRef<{
    lastLap: number | null;
    lapStartFuel: number | null;
    samples: number[];
  }>({ lastLap: null, lapStartFuel: null, samples: [] });

  const [perLap, setPerLap] = useState<number | null>(null);

  const lap = data?.lap ?? null;
  const fuel = data?.fuelLevel ?? null;

  useEffect(() => {
    if (lap == null || fuel == null) return;
    const s = state.current;

    if (s.lastLap == null) {
      s.lastLap = lap;
      s.lapStartFuel = fuel;
      return;
    }

    if (lap > s.lastLap) {
      // A lap just completed: record how much fuel it cost.
      if (s.lapStartFuel != null) {
        const used = s.lapStartFuel - fuel;
        if (used > 0.01) {
          s.samples.push(used);
          if (s.samples.length > MAX_SAMPLES) s.samples.shift();
          setPerLap(
            s.samples.reduce((a, b) => a + b, 0) / s.samples.length
          );
        }
      }
      s.lastLap = lap;
      s.lapStartFuel = fuel;
    } else if (lap < s.lastLap) {
      // Session reset — start over.
      s.lastLap = lap;
      s.lapStartFuel = fuel;
      s.samples = [];
      setPerLap(null);
    }
  }, [lap, fuel]);

  const lapsLeft =
    perLap && perLap > 0 && fuel != null ? fuel / perLap : null;

  return { perLap, lapsLeft };
}
