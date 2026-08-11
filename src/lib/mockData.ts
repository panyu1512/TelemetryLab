/**
 * Client-side mock telemetry.
 *
 * When iRacing (and the Python bridge) aren't available, the app can drive its
 * stores from these synthetic frames instead — so the whole UI is usable
 * offline for development, demos and screenshots. The generators mirror the
 * shapes the Python `mock_bridge` produces, but live entirely in the frontend
 * and are **pure functions of elapsed time `t`** (seconds), which keeps them
 * deterministic and trivially unit-testable. The timer/store plumbing that
 * actually pushes these into the stores lives in `telemetry/mockFeed.ts`.
 */

import type {
  ClassStanding,
  DriverEntry,
  PlayerTelemetry,
  SectorSplit,
  SessionInfo,
  StandingsEntry,
  StandingsPayload,
} from "../telemetry/types";

/** Number of cars in the synthetic field. */
export const MOCK_FIELD_SIZE = 12;
/** Player is always the first car. */
export const MOCK_PLAYER_IDX = 0;
const TANK_CAPACITY = 60; // litres

/**
 * Where the mock race starts — not on the formation lap.
 *
 * A feed that begins at t=0 shows an empty instrument: lap 0, a full tank, no
 * gaps, no positions gained, no tyre laps, and every lap-boundary figure in the
 * app (per-lap burn, last lap, sector deltas) blank until a lap completes. The
 * point of this feed is to explain the UI to someone who has never seen it, so
 * it opens where a race is interesting.
 *
 * Fourteen laps in, specifically: far enough that the slowest GT4s are a lap
 * down on the GT3 leader — 12 s a lap of class difference takes about that long
 * — and two thirds of the way through a stint, so the fuel screen opens on a
 * pit call rather than on a full tank and a shrug.
 */
export const MOCK_START_OFFSET_S = 14 * 138 + 40;

/**
 * How much faster than the wall clock the mock race runs.
 *
 * Lap *times* stay real — a 2:18 lap still reads 2:18, because they are
 * computed in mock seconds. What compresses is how long you wait to see the
 * next one: a lap boundary every ~35 s instead of every 2:18. That matters
 * because the two fuel readouts sample burn at lap boundaries and show
 * "calibrating…" until they have one; at 1× a new user stares at a dash of
 * placeholders for the first two and a half minutes.
 */
export const MOCK_TIME_SCALE = 5;

/** Litres per lap the player's car burns, before per-lap variation. */
const BURN_PER_LAP = 2.85;
/** Laps a full tank covers before the scenario pits. */
const STINT_LAPS = 20;

const CLASS_GT3 = { id: 84, short: "GT3", color: "#ff4d4d", baseLap: 138 };
const CLASS_GT4 = { id: 85, short: "GT4", color: "#4d9dff", baseLap: 150 };

const FIRST = ["Kike", "Matt", "Ana", "Luca", "Sven", "Yuki", "Pia", "Omar", "Nils", "Rui", "Ivo", "Zoe"];
const LAST = ["Ferrer", "Farrow", "Silva", "Rossi", "Berg", "Tanaka", "Costa", "Vega", "Moreau", "Klein", "Novak", "Reyes"];
/** [name, alpha-3 code] pairs, aligned with FIRST/LAST by index. */
const COUNTRIES: Array<[string, string]> = [
  ["Spain", "ESP"],
  ["United Kingdom", "GBR"],
  ["Portugal", "PRT"],
  ["Italy", "ITA"],
  ["Sweden", "SWE"],
  ["Japan", "JPN"],
  ["Germany", "DEU"],
  ["Egypt", "EGY"],
  ["France", "FRA"],
  ["Netherlands", "NLD"],
  ["United States", "USA"],
  ["Brazil", "BRA"],
];

interface MockCar {
  idx: number;
  klass: typeof CLASS_GT3;
  number: string;
  name: string;
  iRating: number;
  isAI: boolean;
  pace: number;
  phase: number;
  wobble: number;
}

/** Deterministic pseudo-random in [0, 1) from a seed (mulberry32-ish). */
function rand(seed: number): number {
  let x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  x -= Math.floor(x);
  return x;
}

/** The field is built once, deterministically, so identities are stable. */
export const MOCK_FIELD: MockCar[] = Array.from({ length: MOCK_FIELD_SIZE }, (_, idx) => {
  const klass = idx % 2 === 0 ? CLASS_GT3 : CLASS_GT4;
  const iRating = Math.round(900 + rand(idx + 1) * 5000);
  return {
    idx,
    klass,
    number: String(1 + Math.floor(rand(idx + 7) * 98)),
    name: `${FIRST[idx % FIRST.length]} ${LAST[idx % LAST.length]}`,
    iRating,
    isAI: idx !== 0 && rand(idx + 3) < 0.5,
    /*
     * Faster drivers lap a touch quicker, plus a stable per-car offset.
     *
     * The divisor was 40 000, which spread a class over ±12 % — seventeen
     * seconds a lap between its quickest and slowest car. A field that spread
     * out that hard was strung into single file within three laps: every
     * interval in the standings read in tens of seconds, nobody ever changed
     * position, and the gap and interval columns showed numbers no real race
     * produces. At 200 000 a class covers about two and a half seconds a lap,
     * which is a grid, and the classes stay 12 s apart because that is what the
     * two base lap times are for.
     */
    pace: klass.baseLap * (1 + (2500 - iRating) / 200000) + rand(idx + 11) * 1.5,
    phase: rand(idx + 5) * 0.4, // grid stagger (fraction of a lap)
    wobble: 0.3 + rand(idx + 13) * 0.9, // lap-time variation amplitude
  };
});

/*
 * Put the player in traffic.
 *
 * Left to itself the field drifts apart over fourteen laps and the player ends
 * up alone — which leaves the Relative, the whole point of which is the cars
 * about to arrive, showing its nearest company forty seconds away. That is a
 * screen with nothing on it to understand. So three cars are pinned to the
 * player's pace and offset by a second or two of track position: one GT3 just
 * ahead, one just behind, and a GT4 close enough to be caught — which is the
 * case the relative's cross-class closing indicator exists for.
 */
{
  const me = MOCK_FIELD[MOCK_PLAYER_IDX];

  // Two GT3s shadowing the player's pace, one either side.
  for (const [idx, dPace, dPhase] of [
    [2, -0.18, 0.011], // ~1.5 s ahead
    [4, 0.12, -0.008], // ~1.1 s behind
  ] as const) {
    MOCK_FIELD[idx].pace = me.pace + dPace;
    MOCK_FIELD[idx].phase = me.phase + dPhase;
  }

  /*
   * And a GT4 the player is about to lap.
   *
   * A slower class cannot simply be given the player's pace — it would stop
   * being a slower class. What puts it alongside is being exactly one lap
   * behind at the moment the feed opens: solve `t/pace = t/myPace − 1` at
   * `MOCK_START_OFFSET_S` and the answer is a perfectly ordinary GT4 lap time.
   * It drifts out of the window over the following few minutes, which is
   * correct — that is what being lapped looks like.
   */
  const gt4 = MOCK_FIELD[3];
  gt4.pace = MOCK_START_OFFSET_S / (MOCK_START_OFFSET_S / me.pace - 1);
  gt4.phase = me.phase + 0.03; // ~4 s up the road, a lap down
}

/**
 * Total laps completed (float): integer part = lap, fraction = lapDistPct.
 *
 * The swing on the end is what makes this a race rather than a procession.
 * With a fixed pace per car the running order never changed after the grid, so
 * the position-change column, the interval column and the relative's closing
 * indicator were all permanently at rest. A slow oscillation of about a second
 * and a half, on a different period per car, lets cars of similar pace trade
 * places the way they do on track.
 *
 * It is deliberately far too small to reverse the lap counter — the swing's
 * gradient is ~3e-5 laps/s against the ~7e-3 of the lap itself. That matters:
 * both fuel samplers read a lap going backwards as a session reset and throw
 * their history away.
 */
function progress(car: MockCar, t: number): number {
  const laps = car.phase + t / car.pace;
  const swing =
    0.03 * car.wobble * Math.sin(t / (car.pace * (1.4 + car.idx * 0.3)) + car.idx);
  return laps + swing;
}

/**
 * This car's most recently *completed* lap time.
 *
 * Keyed on the lap index rather than on `t` directly, which matters more than
 * it looks: a completed lap time only changes when a lap completes. An earlier
 * version varied it continuously with `t`, so at 10 Hz every car's last lap,
 * lap grade and sector splits changed on every tick — which remounted the
 * animated timing cells (they are keyed on their value to replay the sector-pop
 * and lap-flash animations only on a real change) and made the whole table
 * visibly blink.
 */
function lapTime(car: MockCar, t: number): number {
  const lap = Math.floor(progress(car, t));
  return car.pace + car.wobble * Math.sin(lap * 1.7 + car.idx);
}

// ── the lap, as a shape ────────────────────────────────────────────────────

/*
 * The player's inputs used to be three sine waves of `t`: throttle rising and
 * falling on an eight-second period, brake as its inverse, speed and rpm and
 * gear all read straight off the same wave. Every widget fed by them showed
 * something that moved but nothing that meant anything — the trace never had a
 * braking event in it, the gear never stepped down for a corner, the shift
 * lights never swept, and the whole dashboard was impossible to *read* because
 * nothing on it corresponded to anything a driver does.
 *
 * So the lap is a shape now, indexed by track position rather than by time:
 * six braking zones roughly where Spa's are, a top speed on the straights, and
 * speed interpolated between them. Everything else is derived from that curve —
 * throttle and brake from whether it is rising or falling, gear from the speed
 * bands, rpm from where the speed sits inside its gear, steering and lateral g
 * from how close the car is to an apex. The instruments agree with each other
 * because they are all reading the same drive.
 */

/** Braking zones: `at` is lap fraction, `v` the apex speed in km/h, `dir` the
 *  steering sign (+1 right, −1 left). Ordered around the lap. */
const CORNERS: Array<{ at: number; v: number; dir: number }> = [
  { at: 0.02, v: 68, dir: 1 }, // La Source
  { at: 0.29, v: 118, dir: 1 }, // Les Combes
  { at: 0.4, v: 92, dir: -1 }, // Rivage
  { at: 0.55, v: 165, dir: -1 }, // Pouhon
  { at: 0.73, v: 128, dir: 1 }, // Stavelot
  { at: 0.94, v: 62, dir: -1 }, // Bus Stop
];

const V_MAX = 288; // km/h on the Kemmel straight
const V_MIN = 55;
/** How quickly speed recovers away from an apex, in km/h per lap-fraction. */
const ACCEL_RATE = 2100;
/** Steeper than acceleration: braking zones are short and violent. */
const BRAKE_RATE = 5200;

/** Cyclic distance between two lap fractions, in [0, 0.5]. */
function lapGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 1;
  return Math.min(d, 1 - d);
}

/**
 * Target speed at a point on the lap: every corner pulls the car down towards
 * its apex speed, and the lowest of those constraints wins. Approaching an apex
 * is steep (braking), leaving it is shallow (acceleration), which is what puts
 * a recognisable sawtooth in the trace rather than a sine.
 */
function speedAt(pct: number): number {
  let v = V_MAX;
  for (const c of CORNERS) {
    const d = lapGap(pct, c.at);
    // Ahead of the apex the car is braking; past it, accelerating.
    const before = ((c.at - pct + 1) % 1) < 0.5;
    const rate = before ? BRAKE_RATE : ACCEL_RATE;
    v = Math.min(v, c.v + d * rate);
  }
  return Math.max(V_MIN, v);
}

/** Gear boundaries in km/h — index i is the lower bound of gear i+1. */
const GEAR_STEPS = [0, 72, 108, 145, 186, 232];

function gearFor(kmh: number): number {
  let g = 1;
  for (let i = 0; i < GEAR_STEPS.length; i++) if (kmh >= GEAR_STEPS[i]) g = i + 1;
  return Math.max(1, Math.min(6, g));
}

/** Revs from where the speed sits inside its gear's band. */
function rpmFor(kmh: number, gear: number): number {
  const lo = GEAR_STEPS[gear - 1];
  const hi = gear < 6 ? GEAR_STEPS[gear] : V_MAX + 20;
  const f = Math.max(0, Math.min(1, (kmh - lo) / Math.max(1, hi - lo)));
  return 3600 + f * 4000; // 3600 off the corner → 7600 at the shift light
}

// ── player telemetry ───────────────────────────────────────────────────────

export function mockPlayerTelemetry(t: number): PlayerTelemetry {
  const car = MOCK_FIELD[MOCK_PLAYER_IDX];
  const prog = progress(car, t);
  const lap = Math.floor(prog);
  const pct = prog - lap;

  // Speed now, and a moment ago, so the pedals can be read off the gradient.
  const kmh = speedAt(pct);
  const dPct = 0.004;
  const prev = speedAt((pct - dPct + 1) % 1);
  const slope = (kmh - prev) / dPct; // km/h per lap-fraction

  // Steering and lateral load come from the nearest apex: hardest at the apex
  // itself, released down the straights.
  const near = CORNERS.reduce((a, c) =>
    lapGap(pct, c.at) < lapGap(pct, a.at) ? c : a
  );
  const nearness = Math.max(0, 1 - lapGap(pct, near.at) / 0.055);
  const pastApex = (pct - near.at + 1) % 1;

  const brake = Math.max(0, Math.min(1, -slope / BRAKE_RATE));
  /*
   * Flat speed is not a lifted throttle. Reading the pedal straight off the
   * gradient put throttle at 0 all the way down the Kemmel straight — the car
   * is pinned there, it has simply run out of gears. So: braking ⇒ nothing,
   * otherwise flat out, except for the first 2 % of the lap past an apex where
   * it feeds in progressively, which is the shape a real trace has.
   */
  const throttle =
    brake > 0.02
      ? 0
      : nearness > 0 && pastApex < 0.02
        ? Math.max(0.25, pastApex / 0.02)
        : 1;
  const steer = near.dir * nearness * (1 - kmh / (V_MAX * 1.6));

  const gear = gearFor(kmh);
  const rpm = rpmFor(kmh, gear);
  const pos = playerPosition(t);

  // Fuel: burned down a stint, refilled at the stop. Monotonic within a stint,
  // which is what lets both fuel readouts sample a per-lap burn from it.
  const stintLap = lap % STINT_LAPS;
  const burned = (stintLap + pct) * BURN_PER_LAP;
  const fuelLevel = Math.max(1.2, TANK_CAPACITY - burned);
  const fuelPct = fuelLevel / TANK_CAPACITY;

  /*
   * Tyres are spread across the heat scale on purpose: the fronts work harder
   * than the rears at Spa and the left-hand tyres take the long right-handers,
   * so the corners land on four different colours (green → orange) instead of
   * the single green a flat ±6 °C sine gave every one of them. Each corner also
   * gains temperature through the lap and sheds it on the straights.
   */
  const load = 0.5 + 0.5 * Math.sin(pct * Math.PI * 2 - 1.2);
  const corner = (base: number, spread: number, i: number) => {
    const mid = base + 5 * load + 1.5 * Math.sin(t * 0.07 + i);
    return {
      tempL: round(mid - spread, 1),
      tempM: round(mid, 1),
      tempR: round(mid + spread, 1),
      pressure: round(168 + 3 * load + Math.sin(t * 0.05 + i), 1),
    };
  };

  return {
    sessionTime: round(t, 3),
    speed: round(kmh / 3.6, 3),
    speedKmh: round(kmh, 1),
    rpm: Math.round(rpm),
    gear,
    throttle: round(throttle, 3),
    brake: round(brake, 3),
    steeringWheelAngle: round(steer, 4),
    steeringDeg: round((steer * 180) / Math.PI, 1),
    fuelLevel: round(fuelLevel, 2),
    fuelLevelPct: round(fuelPct, 3),
    lapCurrentLapTime: round(pct * car.pace, 3),
    lapBestLapTime: round(car.pace - 0.8, 3),
    lapLastLapTime: round(lapTime(car, t), 3),
    lap,
    lapDistPct: round(pct, 4),
    // The standings channel is still authoritative, but the player's own
    // position is a real iRacing channel and the Position widget reads it from
    // here. Nulling it left that widget showing "P—" in every demo and every
    // screenshot we have ever taken.
    playerCarPosition: pos.overall,
    playerCarClassPosition: pos.inClass,
    latAccel: round(near.dir * nearness * 2.4 * (kmh / 100), 2),
    lonAccel: round(6.5 * throttle - 11 * brake, 2),
    onPitRoad: false,
    airTemp: 22,
    trackTemp: round(30 + 2 * Math.sin(t * 0.01), 1),
    tyres: {
      lf: corner(88, 4, 0), // works hardest — orange
      rf: corner(83, 3.5, 1),
      lr: corner(79, 3, 2),
      rr: corner(76, 2.5, 3), // coolest — green
    },
  };
}

// ── session ─────────────────────────────────────────────────────────────────

function driverEntry(car: MockCar, t: number): DriverEntry {
  return {
    carIdx: car.idx,
    userId: 100000 + car.idx,
    userName: car.name,
    teamName: "",
    carNumber: car.number,
    carClassId: car.klass.id,
    carClassShortName: car.klass.short,
    carPath: car.klass.short.toLowerCase(),
    carMake: car.klass === CLASS_GT3 ? "Audi" : "McLaren",
    carModel: car.klass === CLASS_GT3 ? "Audi R8 LMS EVO II" : "McLaren 570S GT4",
    carScreenName: car.klass === CLASS_GT3 ? "Audi R8 LMS EVO II" : "McLaren 570S GT4",
    iRating: car.iRating,
    licenseLevel: 13,
    licenseString: "A 3.50",
    licenseGroup: "A",
    licenseCategory: "road",
    safetyRating: 3.5,
    licenseColor: "#00ff88",
    carClassColor: car.klass.color,
    clubName: "Iberia",
    countryName: COUNTRIES[car.idx % COUNTRIES.length][0],
    countryCode: COUNTRIES[car.idx % COUNTRIES.length][1],
    division: (car.idx % 5) + 1,
    /* Incidents accumulate. The player's used to be a flat 0 — which is the one
       value that makes the session strip's INC field impossible to understand,
       since it never leaves its resting state and never reaches the amber the
       field is designed to warn with. Four by lap 11, climbing every few laps. */
    incidentCount: car.idx % 4 === 0 ? 2 + Math.floor(t / 420) : car.idx % 4,
    isPaceCar: false,
    isSpectator: false,
    isAI: car.isAI,
    isTeamDriver: false,
  };
}

export function mockSession(t: number): SessionInfo {
  const drivers = MOCK_FIELD.map((car) => driverEntry(car, t));
  const classIds = [...new Set(MOCK_FIELD.map((c) => c.klass))];
  return {
    sessionId: "mock",
    sessionNum: 0,
    sessionType: "Race",
    sessionName: "RACE",
    sessionState: t < 10 ? 2 : 4,
    sessionStateLabel: t < 10 ? "Warmup" : "Racing",
    sessionTimeRemain: Math.max(0, 3600 - t),
    sessionLapsRemain: null,
    sessionTimeTotal: 3600,
    sessionLapsTotal: null,
    isTimed: true,
    flags: ["green"],
    flagsRaw: 0x00000004,
    category: "Road",
    sof: Math.round(avg(MOCK_FIELD.map((c) => c.iRating))),
    track: {
      trackId: 266,
      name: "Circuit de Spa-Francorchamps",
      config: "Grand Prix Pits",
      city: "Stavelot",
      country: "Belgium",
      lengthKm: 7.0,
      numTurns: 19,
    },
    weather: {
      airTemp: 22,
      trackTemp: round(30 + 2 * Math.sin(t * 0.01), 1),
      skies: "Partly Cloudy",
      trackWetness: "Dry",
    },
    classes: classIds.map((k) => {
      const cars = MOCK_FIELD.filter((c) => c.klass === k);
      return {
        carClassId: k.id,
        shortName: k.short,
        color: k.color,
        sof: Math.round(avg(cars.map((c) => c.iRating))),
        carCount: cars.length,
      };
    }),
    drivers,
    driverCarIdx: MOCK_PLAYER_IDX,
    carRedlineRpm: 7800,
    carEstLapTime: MOCK_FIELD[MOCK_PLAYER_IDX].pace,
    sectorStarts: [0, 0.34, 0.71],
  };
}

// ── standings ────────────────────────────────────────────────────────────────

/**
 * Fraction of a lap each sector occupies, matching `mockSession`'s
 * `sectorStarts` of `[0, 0.34, 0.71]`.
 */
const SECTOR_SHARE = [0.34, 0.37, 0.29];

/** This car's best time for sector `i`, derived from its best lap. */
function sectorBest(car: MockCar, i: number): number {
  return (car.pace - 0.8) * SECTOR_SHARE[i];
}

/**
 * This car's last time for sector `i`.
 *
 * The three sectors are perturbed on different periods so a car can be up in
 * one and down in another — which is the whole point of a sector column, and
 * what a flat "lap × share" split cannot show.
 */
function sectorLast(car: MockCar, t: number, i: number): number {
  // Per completed lap, like `lapTime` — see the note there on why this must not
  // vary continuously.
  const lap = Math.floor(progress(car, t));
  const swing = car.wobble * 0.5 * Math.sin(lap * 2.3 + car.idx + i * 2.1);
  return sectorBest(car, i) + Math.max(-0.45, swing);
}

/**
 * The grid this field started from: iRating order, which is a fair proxy for a
 * qualifying result and — being derived from the stable field — keeps
 * `positionsGainedTotal` deterministic in `t` like everything else here.
 */
const GRID_POS = new Map<number, number>(
  [...MOCK_FIELD]
    .sort((a, b) => b.iRating - a.iRating)
    .map((car, i) => [car.idx, i + 1])
);

/** The running order at `t`, leader first. */
function runningOrder(t: number): MockCar[] {
  return [...MOCK_FIELD].sort((a, b) => progress(b, t) - progress(a, t));
}

/**
 * The player's own position, overall and in class — the same ordering the
 * standings payload uses, exposed so the telemetry frame can carry iRacing's
 * `PlayerCarPosition` channels rather than nulls.
 */
function playerPosition(t: number): { overall: number; inClass: number } {
  const ordered = runningOrder(t);
  const me = MOCK_FIELD[MOCK_PLAYER_IDX];
  const overall = ordered.findIndex((c) => c.idx === me.idx) + 1;
  const inClass =
    ordered.filter((c) => c.klass === me.klass).findIndex((c) => c.idx === me.idx) + 1;
  return { overall, inClass };
}

export function mockStandings(t: number): StandingsPayload {
  const ordered = runningOrder(t);
  /* The order one lap ago, so the position-change arrow has something to show.
     It was hard-coded to 0, which meant the column existed in every screenshot
     and never once demonstrated what it is for. */
  const prevOrder = runningOrder(Math.max(0, t - MOCK_FIELD[MOCK_PLAYER_IDX].pace));
  const prevPos = new Map(prevOrder.map((c, i) => [c.idx, i + 1]));
  const leaderProg = progress(ordered[0], t);
  // Track position of the player, so we can express each car's on-track gap
  // relative to them (drives the Relative screen).
  const playerProg = progress(MOCK_FIELD[MOCK_PLAYER_IDX], t);

  // Overall + per-class positions.
  const overallPos = new Map<number, number>();
  ordered.forEach((c, i) => overallPos.set(c.idx, i + 1));
  const classSeen = new Map<number, number>();
  const classPos = new Map<number, number>();
  for (const c of ordered) {
    const n = (classSeen.get(c.klass.id) ?? 0) + 1;
    classSeen.set(c.klass.id, n);
    classPos.set(c.idx, n);
  }

  /* Field-wide bests, resolved once up front: the timing screen grades laps and
     sectors against these, and a mock that never produced a purple or a green
     left most of the surface's colour system impossible to see (which is
     exactly how it shipped). */
  const lastLapOf = new Map<number, number>(
    MOCK_FIELD.map((c) => [c.idx, lapTime(c, t)])
  );
  const fieldBestLap = Math.min(...MOCK_FIELD.map((c) => c.pace - 0.8));
  const fastestLapNow = Math.min(...lastLapOf.values());
  const fieldBestSector = SECTOR_SHARE.map((_, i) =>
    Math.min(...MOCK_FIELD.map((c) => sectorLast(c, t, i)))
  );

  /* Gaps to the leader, in running order — the source for each car's interval
     to the one directly ahead of it (overall and in class). */
  const gapOf = new Map<number, number>(
    ordered.map((c) => [c.idx, Math.max(0, (leaderProg - progress(c, t)) * c.pace)])
  );
  const interval = (car: MockCar, within: readonly MockCar[]): number | null => {
    const i = within.indexOf(car);
    if (i <= 0) return null; // the leader has nobody ahead
    const ahead = within[i - 1];
    return round(
      Math.max(0, (gapOf.get(car.idx) ?? 0) - (gapOf.get(ahead.idx) ?? 0)),
      3
    );
  };
  const inClassOrder = new Map<number, MockCar[]>();
  for (const c of ordered) {
    const list = inClassOrder.get(c.klass.id) ?? [];
    list.push(c);
    inClassOrder.set(c.klass.id, list);
  }

  // Built from `ordered`, not `MOCK_FIELD`: the payload's entry sequence *is* the
  // overall running order (the store turns it straight into `order`), so emitting
  // declaration order made the flat/overall standings view render scrambled.
  const entries: StandingsEntry[] = ordered.map((car) => {
    const prog = progress(car, t);
    const lap = Math.floor(prog);
    const pct = prog - lap;
    const gap = (leaderProg - prog) * car.pace; // seconds behind leader
    const pos = overallPos.get(car.idx) ?? null;
    // Signed on-track gap to the player, wrapped to the nearest ±half-lap and
    // scaled to seconds. Positive = ahead of the player, negative = behind.
    const dLaps = prog - playerProg;
    const relLaps = dLaps - Math.round(dLaps); // → [-0.5, 0.5]
    const intervalToPlayer =
      car.idx === MOCK_PLAYER_IDX ? 0 : round(relLaps * car.pace, 3);

    // Lap grade. Purple only for the single quickest lap on track right now,
    // and only when it actually beats the field's best; green whenever a car
    // improves on its own.
    const last = lastLapOf.get(car.idx) ?? lapTime(car, t);
    const best = car.pace - 0.8;
    const lastLapStatus: StandingsEntry["lastLapStatus"] =
      last <= fastestLapNow && last < fieldBestLap
        ? "overall_best"
        : last <= best
          ? "personal_best"
          : "normal";

    const sectors: SectorSplit[] = SECTOR_SHARE.map((_, i) => {
      const lastTime = sectorLast(car, t, i);
      const bestTime = sectorBest(car, i);
      const delta = lastTime - bestTime;
      const status: SectorSplit["status"] =
        lastTime <= fieldBestSector[i]
          ? "overall_best"
          : delta <= 0
            ? "personal_best"
            : delta <= 0.35
              ? "slower"
              : "much_slower";
      return {
        index: i,
        lastTime: round(lastTime, 3),
        bestTime: round(bestTime, 3),
        delta: round(delta, 3),
        status,
      };
    });

    const gained = (GRID_POS.get(car.idx) ?? 0) - (pos ?? 0);
    const gainedLastLap = (prevPos.get(car.idx) ?? pos ?? 0) - (pos ?? 0);

    /* Laps down. The GT4s lap ~12 s slower than the GT3s, so by lap 11 the tail
       of the field is genuinely a lap behind — the payload just used to say
       otherwise, which meant the "+1 lap" branch of the gap cell had never been
       seen outside a real session. */
    const lapsBehind = Math.floor(leaderProg - prog);
    const classLeaderProg = progress(
      (inClassOrder.get(car.klass.id) ?? [car])[0],
      t
    );
    const classLapsBehind = Math.floor(classLeaderProg - prog);
    /* Seconds behind the leader *of this car's class* — which is not the same
       number as the gap to the overall leader, and used to be set to it. In a
       grouped table that made every GT4 read three minutes behind its own class
       leader, including the class leader itself. */
    const classGap = (classLeaderProg - prog) * car.pace;
    // A rough projection: places are worth more against a strong field, and a
    // driver rated above the field average has more to lose than to gain.
    const iRatingChangeEst = Math.round(
      gained * 4 + (2500 - car.iRating) / 400
    );

    // One car in the pits and one off-track at any time, rotating slowly, so
    // the state column is never dead in a demo or a screenshot.
    const rotation = Math.floor(t / 25);
    const onPitRoad = car.idx === (rotation * 5) % MOCK_FIELD_SIZE;
    const isOffTrack = car.idx === (rotation * 7 + 3) % MOCK_FIELD_SIZE;

    return {
      carIdx: car.idx,
      position: pos,
      classPosition: classPos.get(car.idx) ?? null,
      carClassId: car.klass.id,
      lap,
      lapDistPct: round(pct, 4),
      lastLapTime: round(last, 3),
      bestLapTime: round(best, 3),
      gapToLeader: round(Math.max(0, gap), 3),
      interval: interval(car, ordered),
      gapIsLaps: lapsBehind >= 1,
      lapsDown: Math.max(0, lapsBehind),
      gapToClassLeader: round(Math.max(0, classGap), 3),
      classInterval: interval(car, inClassOrder.get(car.klass.id) ?? []),
      classGapIsLaps: classLapsBehind >= 1,
      intervalToPlayer,
      estCatchTime: null,
      positionsGainedTotal: gained,
      positionsGainedLastLap: gainedLastLap,
      iRating: car.iRating,
      iRatingChangeEst,
      lastLapStatus,
      sectors,
      theoreticalBest: round(
        sectors.reduce((sum, s) => sum + (s.bestTime ?? 0), 0),
        3
      ),
      onPitRoad,
      trackSurfaceLabel: onPitRoad ? "AproachingPits" : "OnTrack",
      isOffTrack,
      isInPitStall: false,
      isInWorld: true,
      isRetired: false,
      isPlayer: car.idx === MOCK_PLAYER_IDX,
      isOverallLeader: pos === 1,
      isClassLeader: classPos.get(car.idx) === 1,
      isLapped: false,
      // Alternate the compound across the field so the tyre cell's colour
      // coding is visible at all in a mock session.
      tireCompound: car.idx % 3 === 0 ? 0 : car.idx % 3 === 1 ? 1 : 2,
      // Laps on the *set*, not laps in the race — they reset at a stop, and a
      // set age that only ever climbed made the cell read as a lap counter.
      tireLaps: lap % STINT_LAPS,
    };
  });

  const classIds = [...new Set(MOCK_FIELD.map((c) => c.klass))];
  const classes: ClassStanding[] = classIds.map((k) => {
    const inClass = ordered.filter((c) => c.klass === k);
    const leader = inClass[0];
    // The fastest lap belongs to the lowest pace in the class, which is not
    // generally the car leading it. The standings spend their one filled cell on
    // this car, so pinning it to the leader made the preview misrepresent the
    // design (`design.md` § Dense tabular overlays, rule 5).
    const fastest = inClass.reduce((a, c) => (c.pace < a.pace ? c : a), inClass[0]);
    return {
      carClassId: k.id,
      shortName: k.short,
      color: k.color,
      sof: Math.round(avg(inClass.map((c) => c.iRating))),
      carCount: inClass.length,
      leaderCarIdx: leader?.idx ?? null,
      leaderLap: leader ? Math.floor(progress(leader, t)) : null,
      fastestLap: fastest ? round(fastest.pace - 0.8, 3) : null,
      fastestLapCarIdx: fastest?.idx ?? null,
      order: inClass.map((c) => c.idx),
    };
  });

  return {
    playerCarIdx: MOCK_PLAYER_IDX,
    sectorCount: 3,
    overallBestLap: round(Math.min(...MOCK_FIELD.map((c) => c.pace - 0.8)), 3),
    // The field's fastest lap, not whoever happens to be leading it.
    overallBestLapCarIdx: MOCK_FIELD.reduce(
      (a, c) => (c.pace < a.pace ? c : a),
      MOCK_FIELD[0]
    ).idx,
    overallBestSectors: [null, null, null],
    classes,
    entries,
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function round(n: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
