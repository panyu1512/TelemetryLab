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
    /** Where on the lap the current interval started, so a part lap can be
     *  scaled up to one. `null` once we are measuring whole laps. */
    startPct: number | null;
  }>({ lastLap: null, lapStartFuel: null, samples: [], startPct: null });

  const [perLap, setPerLap] = useState<number | null>(null);

  const lap = data?.lap ?? null;
  const fuel = data?.fuelLevel ?? null;
  const distPct = data?.lapDistPct ?? null;

  useEffect(() => {
    if (lap == null || fuel == null) return;
    const s = state.current;

    if (s.lastLap == null) {
      s.lastLap = lap;
      s.lapStartFuel = fuel;
      s.startPct = distPct;
      return;
    }

    if (lap > s.lastLap) {
      /*
       * A lap just completed: record how much fuel it cost.
       *
       * The first interval is the awkward one — we start watching wherever the
       * driver happened to be on the lap, so it covers only the rest of it and
       * reads low. Taking it at face value put the burn up to 30 % under until
       * it aged out of the window five laps later, and everything derived from
       * it (laps left, fuel to finish, the save target) was wrong meanwhile.
       * Scaling it by the fraction it actually covered fixes that without
       * costing a lap of waiting — but only down to half a lap, below which
       * the extrapolation is doing more work than the measurement.
       */
      const covered = s.startPct == null ? 1 : 1 - s.startPct;
      if (s.lapStartFuel != null && covered >= 0.5) {
        const used = (s.lapStartFuel - fuel) / covered;
        if (used > 0.01) {
          s.samples.push(used);
          if (s.samples.length > MAX_SAMPLES) s.samples.shift();
          setPerLap(
            s.samples.reduce((a, b) => a + b, 0) / s.samples.length
          );
        }
      }
      s.startPct = null;
      s.lastLap = lap;
      s.lapStartFuel = fuel;
    } else if (lap < s.lastLap) {
      // Session reset — start over.
      s.lastLap = lap;
      s.lapStartFuel = fuel;
      s.samples = [];
      s.startPct = distPct;
      setPerLap(null);
    }
  }, [lap, fuel, distPct]);

  const lapsLeft =
    perLap && perLap > 0 && fuel != null ? fuel / perLap : null;

  return { perLap, lapsLeft };
}
