import { useEffect, useRef, useState } from "react";
import type { PlayerTelemetry, SessionInfo } from "../telemetry/types";
import {
  computeFuelStrategy,
  type FuelStrategy,
  type FuelInputs,
} from "../lib/fuelStrategy";

/**
 * Stateful front-end for the fuel & strategy calculator.
 *
 * The bridge publishes a raw fuel *level* but never a per-lap burn or a lap-time
 * average, so this hook derives both by sampling at each lap boundary — the same
 * technique as {@link useFuelEstimate}, widened to a configurable rolling window
 * and paired with lap-time sampling so timed races can estimate laps-to-flag.
 *
 * It also tracks the things the pure calculator can't see frame-to-frame:
 *   - **Tank capacity**, inferred from `level ÷ fraction` while the tank is
 *     comfortably full (the ratio gets noisy near empty).
 *   - **Stint start**, reset whenever the car leaves pit road (a fresh fuel
 *     load), so stint progress and pit windows are anchored correctly.
 *   - **Out-of-fuel**, latched when the tank runs dry on track, cleared on the
 *     next refuel — surfaced so the UI can raise an incident-style alert.
 *
 * Everything derived here is fed as a clean {@link FuelInputs} snapshot into
 * {@link computeFuelStrategy}, which owns all the actual strategy math.
 */

export interface FuelStrategyOptions {
  /**
   * Safety margin at the flag in laps, as iRacing's AutoFuel expresses it
   * (default 1.0 — AutoFuel's own floor for a timed race). See
   * {@link FuelInputs.marginLaps}.
   */
  marginLaps?: number;
  /** Manual per-stop fuel fill in litres; `null` ⇒ auto (top up as needed). */
  pitFuel?: number | null;
  /** Number of recent laps to average burn / lap time over (default 5). */
  sampleWindow?: number;
}

export interface FuelStrategyResult {
  strategy: FuelStrategy;
  /** How many completed-lap burn samples have been collected (0 = calibrating). */
  sampleCount: number;
  /** Latched when the car ran dry on track; cleared on the next refuel. */
  outOfFuel: boolean;
}

/** Below this level (litres), on track, we consider the car out of fuel. */
const OUT_OF_FUEL_L = 0.2;
/** Level must recover above this (litres) to clear the out-of-fuel latch. */
const REFUELLED_L = 5.0;
/** Minimum tank fraction at which the capacity estimate is trustworthy. */
const CAPACITY_MIN_PCT = 0.1;

interface SamplerState {
  lastLap: number | null;
  lapStartFuel: number | null;
  /** Where on the lap the current interval started, so a part lap can be
   *  scaled up to one. `null` once we are measuring whole laps. */
  startPct: number | null;
  burn: number[];
  lapTimes: number[];
  wasOnPitRoad: boolean;
  outOfFuelLatched: boolean;
}

export function useFuelStrategy(
  data: PlayerTelemetry | null,
  session: SessionInfo | null,
  options: FuelStrategyOptions = {}
): FuelStrategyResult {
  const marginLaps = options.marginLaps ?? 1;
  const pitFuel = options.pitFuel ?? null;
  const window = Math.max(1, options.sampleWindow ?? 5);

  const s = useRef<SamplerState>({
    lastLap: null,
    lapStartFuel: null,
    startPct: null,
    burn: [],
    lapTimes: [],
    wasOnPitRoad: false,
    outOfFuelLatched: false,
  });

  const [perLap, setPerLap] = useState<number | null>(null);
  const [avgLapTime, setAvgLapTime] = useState<number | null>(null);
  const [stintStartLap, setStintStartLap] = useState<number | null>(null);
  const [tankCapacity, setTankCapacity] = useState<number | null>(null);
  const [outOfFuel, setOutOfFuel] = useState(false);
  const [sampleCount, setSampleCount] = useState(0);

  const lap = data?.lap ?? null;
  const fuel = data?.fuelLevel ?? null;
  const fuelPct = data?.fuelLevelPct ?? null;
  const lastLapTime = data?.lapLastLapTime ?? null;
  const distPct = data?.lapDistPct ?? null;
  const onPitRoad = data?.onPitRoad ?? null;

  // ── capacity estimate ──────────────────────────────────────────────────────
  useEffect(() => {
    if (fuel == null || fuelPct == null || fuelPct < CAPACITY_MIN_PCT) return;
    const est = fuel / fuelPct;
    if (!Number.isFinite(est) || est <= 0) return;
    setTankCapacity((prev) =>
      prev == null || Math.abs(prev - est) > 0.5 ? round1(est) : prev
    );
  }, [fuel, fuelPct]);

  // ── stint tracking (reset on pit exit) ─────────────────────────────────────
  useEffect(() => {
    if (onPitRoad == null || lap == null) return;
    const st = s.current;
    if (st.wasOnPitRoad && !onPitRoad) {
      // Just left the pits on a fresh fuel load: a new stint begins.
      setStintStartLap(lap);
      st.lapStartFuel = fuel; // avoid a bogus sample spanning the stop
      st.startPct = distPct; // …and the rest of this lap is a part lap
    }
    st.wasOnPitRoad = onPitRoad;
  }, [onPitRoad, lap, fuel]);

  // ── out-of-fuel latch ──────────────────────────────────────────────────────
  useEffect(() => {
    if (fuel == null) return;
    const st = s.current;
    const onTrack = onPitRoad === false;
    if (!st.outOfFuelLatched && onTrack && fuel <= OUT_OF_FUEL_L) {
      st.outOfFuelLatched = true;
      setOutOfFuel(true);
    } else if (st.outOfFuelLatched && fuel >= REFUELLED_L) {
      st.outOfFuelLatched = false;
      setOutOfFuel(false);
    }
  }, [fuel, onPitRoad]);

  // ── per-lap burn + lap-time sampling ───────────────────────────────────────
  useEffect(() => {
    if (lap == null || fuel == null) return;
    const st = s.current;

    if (st.lastLap == null) {
      st.lastLap = lap;
      st.lapStartFuel = fuel;
      st.startPct = distPct;
      if (stintStartLap == null) setStintStartLap(lap);
      return;
    }

    if (lap > st.lastLap) {
      /*
       * A lap completed: record how much fuel it cost, scaling the interval up
       * when it covered only part of a lap — which the first one after we
       * start watching, or after a pit exit, always does. See the longer note
       * on the same guard in {@link useFuelEstimate}.
       */
      const covered = st.startPct == null ? 1 : 1 - st.startPct;
      if (st.lapStartFuel != null && covered >= 0.5) {
        const used = (st.lapStartFuel - fuel) / covered;
        if (used > 0.01) {
          st.burn.push(used);
          if (st.burn.length > window) st.burn.shift();
          setPerLap(avg(st.burn));
          setSampleCount(st.burn.length);
        }
      }
      // Record the lap time (published as the just-completed lap's time).
      if (lastLapTime != null && lastLapTime > 0) {
        st.lapTimes.push(lastLapTime);
        if (st.lapTimes.length > window) st.lapTimes.shift();
        setAvgLapTime(avg(st.lapTimes));
      }
      st.startPct = null;
      st.lastLap = lap;
      st.lapStartFuel = fuel;
    } else if (lap < st.lastLap) {
      // Session reset / new session — start clean.
      st.lastLap = lap;
      st.lapStartFuel = fuel;
      st.burn = [];
      st.lapTimes = [];
      st.startPct = distPct;
      st.outOfFuelLatched = false;
      setPerLap(null);
      setAvgLapTime(null);
      setSampleCount(0);
      setStintStartLap(lap);
      setOutOfFuel(false);
    }
    // `stintStartLap` intentionally omitted: we only seed it on first sight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lap, fuel, lastLapTime, distPct, window]);

  // Prefer the sampled lap-time average, then best lap, then the SDK estimate.
  const effectiveLapTime =
    avgLapTime ??
    (data?.lapBestLapTime && data.lapBestLapTime > 0
      ? data.lapBestLapTime
      : null) ??
    (session?.carEstLapTime && session.carEstLapTime > 0
      ? session.carEstLapTime
      : null);

  const inputs: FuelInputs = {
    fuelLevel: fuel,
    tankCapacity,
    perLap,
    avgLapTime: effectiveLapTime,
    currentLap: lap,
    stintStartLap,
    lapsRemaining: session?.sessionLapsRemain ?? null,
    timeRemaining: session?.sessionTimeRemain ?? null,
    isTimed: session?.isTimed ?? true,
    marginLaps,
    pitFuel,
  };

  return {
    strategy: computeFuelStrategy(inputs),
    sampleCount,
    outOfFuel,
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function avg(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
