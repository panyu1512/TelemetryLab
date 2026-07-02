/**
 * Fuel & strategy calculator — pure math.
 *
 * All of the number-crunching for the Fuel Calc screen lives here as
 * side-effect-free functions so it can be reasoned about (and, later, tested)
 * in isolation. The stateful bits — sampling per-lap burn, tracking the current
 * stint, detecting an empty tank — live in `hooks/useFuelStrategy.ts`, which
 * feeds this module a clean {@link FuelInputs} snapshot each frame.
 *
 * Everything degrades gracefully: any missing input collapses the affected
 * outputs to `null` rather than throwing, so the UI can render "—" placeholders
 * before the first lap of consumption data arrives.
 */

// ── inputs ─────────────────────────────────────────────────────────────────

export interface FuelInputs {
  /** Litres currently in the tank. */
  fuelLevel: number | null;
  /** Total tank capacity in litres (derived from level ÷ fraction). */
  tankCapacity: number | null;
  /** Rolling average litres burned per lap. */
  perLap: number | null;
  /** Rolling average lap time in seconds (for timed-race lap estimates). */
  avgLapTime: number | null;
  /** The lap the player is currently on (1-based). */
  currentLap: number | null;
  /** Lap the current fuel load / stint began on (from the last pit exit). */
  stintStartLap: number | null;

  /** Whole laps left to the flag, when the race is lap-limited. */
  lapsRemaining: number | null;
  /** Seconds left to the flag, when the race is timed. */
  timeRemaining: number | null;
  isTimed: boolean;

  /** Safety reserve as a fraction of the tank (e.g. 0.05 = 5%). */
  reservePct: number;
  /**
   * Manual override: litres to add at each stop. `null` ⇒ the planner tops up
   * to whatever the stint needs (up to a full tank).
   */
  pitFuel: number | null;
}

// ── outputs ────────────────────────────────────────────────────────────────

export type FuelStatus =
  | "calibrating" // no per-lap burn yet
  | "finish" // current fuel lasts to the flag
  | "save" // won't quite make it, but a fuel-save could close the gap
  | "pit" // a stop is required
  | "empty"; // tank essentially dry

/** One candidate pit strategy over the remaining race. */
export interface StintPlan {
  /** Number of pit stops. */
  stops: number;
  /** Absolute lap numbers to pit on. */
  pitLaps: number[];
  /** Litres to add at each corresponding stop. */
  addFuel: number[];
  /** Human label, e.g. "1-stop" / "No stop". */
  label: string;
}

export interface FuelStrategy {
  status: FuelStatus;

  // Consumption / tank.
  perLap: number | null;
  tankCapacity: number | null;
  fuelLevel: number | null;
  fuelPct: number | null;
  /** Litres held back as the safety reserve. */
  reserve: number | null;

  // Race framing.
  /** Whole laps remaining to the flag (given or estimated from time). */
  lapsToFinish: number | null;
  /** Raw laps of fuel: level ÷ perLap. */
  lapsOfFuel: number | null;
  /** Laps of fuel above the reserve. */
  lapsOfFuelSafe: number | null;

  // Finish prediction.
  /** Litres required to reach the flag. */
  fuelToFinish: number | null;
  /** Usable fuel minus fuel-to-finish (>0 surplus, <0 deficit). */
  fuelDelta: number | null;
  /** Whole laps of margin (safe laps − laps to finish). */
  marginLaps: number | null;
  finishesOnFuel: boolean | null;

  // Fuel save.
  /** L/lap the player must average to reach the flag on current fuel. */
  targetPerLap: number | null;
  /** Fraction of consumption to save to finish (0 when not required). */
  saveNeededPct: number | null;

  // Stint / pit window.
  /** Laps a full usable tank lasts. */
  stintLength: number | null;
  /** Laps completed on the current fuel load. */
  stintUsed: number | null;
  /** Total laps this stint is expected to run (used + safe remaining). */
  stintTotal: number | null;
  /** Laps until the tank hits the reserve (must-pit-by countdown). */
  pitInLaps: number | null;
  /** Absolute [earliest, latest] laps to pit within before running dry. */
  pitWindow: [number, number] | null;
  recommendedPitLap: number | null;

  // Strategies (primary first).
  plans: StintPlan[];
}

// ── helpers ────────────────────────────────────────────────────────────────

const EMPTY_THRESHOLD_L = 0.3; // litres — below this the tank is "empty"

function planLabel(stops: number): string {
  if (stops <= 0) return "No stop";
  return `${stops}-stop`;
}

function finite(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * Greedy fewest-stops plan: run each stint until the tank hits the reserve,
 * then add only as much as the rest of the race needs (capped at a full tank,
 * or at `pitFuel` when the user pins a fixed fill).
 */
function greedyPlan(
  lapsToFinish: number,
  perLap: number,
  usableFuel: number,
  usableTank: number,
  currentLap: number,
  pitFuel: number | null
): StintPlan | null {
  if (!(perLap > 0) || !(usableTank > 0) || lapsToFinish <= 0) return null;

  const pitLaps: number[] = [];
  const addFuel: number[] = [];
  let fuel = usableFuel;
  let done = 0; // laps of the remaining race completed so far

  for (let guard = 0; guard < 50; guard++) {
    const stintLaps = Math.floor(fuel / perLap + 1e-9);
    const lapsLeft = lapsToFinish - done;
    if (stintLaps >= lapsLeft) break; // the rest of the race fits in the tank

    // A stop is needed. We run down to (near) the reserve, then refuel.
    const runLaps = Math.max(1, Math.min(stintLaps, lapsLeft - 1));
    done += runLaps;
    const fuelAtPit = fuel - runLaps * perLap;
    const pitLap = currentLap + done;

    const remainingAfter = lapsToFinish - done;
    let added: number;
    if (finite(pitFuel)) {
      added = Math.min(pitFuel, usableTank - fuelAtPit);
    } else {
      const needed = remainingAfter * perLap - fuelAtPit;
      added = Math.min(usableTank - fuelAtPit, Math.max(0, needed));
    }
    if (!(added > 0.01)) break; // can't take on fuel — stop planning

    pitLaps.push(pitLap);
    addFuel.push(round1(added));
    fuel = fuelAtPit + added;
  }

  return {
    stops: pitLaps.length,
    pitLaps,
    addFuel,
    label: planLabel(pitLaps.length),
  };
}

/**
 * Even-split plan for a fixed number of stops: distribute the remaining laps
 * across `stops + 1` roughly-equal stints (respecting the current fuel load for
 * the first stint and the tank size throughout). Returns `null` when the race
 * can't be covered with that many stops.
 */
function evenPlan(
  lapsToFinish: number,
  perLap: number,
  usableFuel: number,
  usableTank: number,
  currentLap: number,
  stops: number,
  pitFuel: number | null
): StintPlan | null {
  if (!(perLap > 0) || !(usableTank > 0) || lapsToFinish <= 0) return null;

  const stints = stops + 1;
  const maxStint = Math.floor(usableTank / perLap + 1e-9);
  const firstMax = Math.floor(usableFuel / perLap + 1e-9);
  if (maxStint < 1 || firstMax < 1) return null;

  const target = Math.ceil(lapsToFinish / stints);
  if (target > maxStint) return null; // infeasible with this many stops

  const pitLaps: number[] = [];
  const addFuel: number[] = [];
  let remaining = lapsToFinish;
  let absLap = currentLap;

  for (let i = 0; i < stints; i++) {
    const cap = i === 0 ? Math.min(firstMax, maxStint) : maxStint;
    const stint =
      i === stints - 1 ? remaining : Math.min(remaining, Math.max(1, Math.min(target, cap)));
    remaining -= stint;
    absLap += stint;
    if (i < stints - 1) {
      pitLaps.push(absLap);
      const need = Math.min(remaining, maxStint) * perLap;
      addFuel.push(round1(finite(pitFuel) ? Math.min(pitFuel, usableTank) : Math.min(usableTank, need)));
    }
    if (remaining <= 0) break;
  }

  if (remaining > 0) return null; // couldn't cover the distance
  return {
    stops: pitLaps.length,
    pitLaps,
    addFuel,
    label: planLabel(pitLaps.length),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ── main ───────────────────────────────────────────────────────────────────

/**
 * Turn a fuel snapshot into the full strategy view. Pure and total: never
 * throws, and any missing input just nulls out the parts that depend on it.
 */
export function computeFuelStrategy(input: FuelInputs): FuelStrategy {
  const {
    fuelLevel,
    tankCapacity,
    perLap,
    avgLapTime,
    currentLap,
    stintStartLap,
    lapsRemaining,
    timeRemaining,
    isTimed,
    reservePct,
    pitFuel,
  } = input;

  const fuelPct =
    finite(fuelLevel) && finite(tankCapacity) && tankCapacity > 0
      ? clamp(fuelLevel / tankCapacity, 0, 1)
      : null;

  // Reserve (litres) is a fraction of the tank when we know it, else of the
  // current level so the safety margin still applies before capacity is known.
  const reserve = finite(tankCapacity)
    ? tankCapacity * reservePct
    : finite(fuelLevel)
      ? fuelLevel * reservePct
      : null;

  const usableFuel =
    finite(fuelLevel) && finite(reserve) ? Math.max(0, fuelLevel - reserve) : null;
  const usableTank =
    finite(tankCapacity) && finite(reserve)
      ? Math.max(0, tankCapacity - reserve)
      : null;

  const hasBurn = finite(perLap) && perLap > 0;

  const lapsOfFuel = hasBurn && finite(fuelLevel) ? fuelLevel / perLap : null;
  const lapsOfFuelSafe = hasBurn && finite(usableFuel) ? usableFuel / perLap : null;

  // Laps to the flag: use the given lap count, else estimate from time.
  let lapsToFinish: number | null = null;
  if (finite(lapsRemaining)) {
    lapsToFinish = Math.max(0, Math.ceil(lapsRemaining));
  } else if (isTimed && finite(timeRemaining) && finite(avgLapTime) && avgLapTime > 0) {
    lapsToFinish = Math.max(0, Math.ceil(timeRemaining / avgLapTime));
  }

  const fuelToFinish =
    hasBurn && finite(lapsToFinish) ? lapsToFinish * perLap : null;
  const fuelDelta =
    finite(usableFuel) && finite(fuelToFinish) ? usableFuel - fuelToFinish : null;
  const marginLaps =
    finite(lapsOfFuelSafe) && finite(lapsToFinish)
      ? Math.floor(lapsOfFuelSafe - lapsToFinish)
      : null;
  const finishesOnFuel = finite(fuelDelta) ? fuelDelta >= 0 : null;

  // Fuel-save: the L/lap you'd have to hit to reach the flag on current fuel.
  let targetPerLap: number | null = null;
  let saveNeededPct: number | null = null;
  if (hasBurn && finite(usableFuel) && finite(lapsToFinish) && lapsToFinish > 0) {
    targetPerLap = usableFuel / lapsToFinish;
    const save = 1 - targetPerLap / perLap;
    saveNeededPct = save > 0 ? save : 0;
  }

  // Stint framing.
  const stintLength =
    hasBurn && finite(usableTank) ? Math.floor(usableTank / perLap + 1e-9) : null;
  const stintUsed =
    finite(currentLap) && finite(stintStartLap)
      ? Math.max(0, currentLap - stintStartLap)
      : null;
  const stintTotal =
    finite(stintUsed) && finite(lapsOfFuelSafe)
      ? stintUsed + Math.max(0, lapsOfFuelSafe)
      : null;

  const pitInLaps = finite(lapsOfFuelSafe) ? Math.max(0, Math.floor(lapsOfFuelSafe)) : null;
  const recommendedPitLap =
    finite(currentLap) && finite(pitInLaps) ? currentLap + pitInLaps : null;
  const pitWindow: [number, number] | null =
    finite(currentLap) && finite(pitInLaps)
      ? [currentLap + Math.max(0, pitInLaps - 1), currentLap + pitInLaps]
      : null;

  // Strategy plans (only meaningful when a stop might be needed).
  const plans: StintPlan[] = [];
  if (
    hasBurn &&
    finite(lapsToFinish) &&
    lapsToFinish > 0 &&
    finite(usableFuel) &&
    finite(usableTank) &&
    finite(currentLap)
  ) {
    const primary = greedyPlan(
      lapsToFinish,
      perLap,
      usableFuel,
      usableTank,
      currentLap,
      pitFuel
    );
    if (primary) {
      plans.push(primary);
      // Offer one alternative with an extra stop (shorter stints / lighter car),
      // but only when it's feasible and actually differs.
      if (primary.stops >= 1) {
        const alt = evenPlan(
          lapsToFinish,
          perLap,
          usableFuel,
          usableTank,
          currentLap,
          primary.stops + 1,
          pitFuel
        );
        if (alt && alt.stops !== primary.stops) plans.push(alt);
      }
    }
  }

  // Overall status.
  let status: FuelStatus;
  if (finite(fuelLevel) && fuelLevel <= EMPTY_THRESHOLD_L) {
    status = "empty";
  } else if (!hasBurn) {
    status = "calibrating";
  } else if (finishesOnFuel === true) {
    status = "finish";
  } else if (
    finishesOnFuel === false &&
    finite(saveNeededPct) &&
    saveNeededPct > 0 &&
    saveNeededPct <= 0.15
  ) {
    // A gap small enough (≤15%) to plausibly close by lifting/coasting.
    status = "save";
  } else if (finishesOnFuel === false) {
    status = "pit";
  } else {
    status = "calibrating";
  }

  return {
    status,
    perLap: hasBurn ? perLap : null,
    tankCapacity: finite(tankCapacity) ? tankCapacity : null,
    fuelLevel: finite(fuelLevel) ? fuelLevel : null,
    fuelPct,
    reserve: finite(reserve) ? reserve : null,
    lapsToFinish,
    lapsOfFuel,
    lapsOfFuelSafe,
    fuelToFinish,
    fuelDelta,
    marginLaps,
    finishesOnFuel,
    targetPerLap,
    saveNeededPct,
    stintLength,
    stintUsed,
    stintTotal,
    pitInLaps,
    pitWindow,
    recommendedPitLap,
    plans,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
