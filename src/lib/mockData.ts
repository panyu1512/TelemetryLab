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
    // Faster drivers lap a touch quicker; add a stable per-car offset.
    pace: klass.baseLap * (1 + (2500 - iRating) / 40000) + rand(idx + 11) * 1.5,
    phase: rand(idx + 5) * 0.4, // grid stagger (fraction of a lap)
    wobble: 0.3 + rand(idx + 13) * 0.9, // lap-time variation amplitude
  };
});

function lapTime(car: MockCar, t: number): number {
  return car.pace + car.wobble * Math.sin(t * 0.03 + car.idx);
}

/** Total laps completed (float): integer part = lap, fraction = lapDistPct. */
function progress(car: MockCar, t: number): number {
  return car.phase + t / car.pace;
}

// ── player telemetry ───────────────────────────────────────────────────────

export function mockPlayerTelemetry(t: number): PlayerTelemetry {
  const car = MOCK_FIELD[MOCK_PLAYER_IDX];
  const prog = progress(car, t);
  const pct = prog - Math.floor(prog);
  const throttle = (Math.sin(t * 0.8) + 1) / 2;
  const brake = Math.max(0, Math.sin(t * 0.8 + Math.PI)) * (throttle < 0.3 ? 1 : 0);
  const speedKmh = 80 + 160 * throttle;
  const rpm = 4000 + 3600 * throttle;
  const steer = 0.6 * Math.sin(t * 0.6);
  const fuelPct = Math.max(0.05, 1 - (t % (car.pace * 20)) / (car.pace * 20));

  const corner = (base: number, i: number) => ({
    tempL: round(base + 6 * Math.sin(t * 0.5 + i) - 4, 1),
    tempM: round(base + 6 * Math.sin(t * 0.5 + i), 1),
    tempR: round(base + 6 * Math.sin(t * 0.5 + i) + 3, 1),
    pressure: round(165 + 4 * Math.sin(t * 0.2 + i), 1),
  });

  return {
    sessionTime: round(t, 3),
    speed: round(speedKmh / 3.6, 3),
    speedKmh: round(speedKmh, 1),
    rpm: Math.round(rpm),
    gear: Math.max(1, Math.min(6, Math.floor(1 + throttle * 5))),
    throttle: round(throttle, 3),
    brake: round(brake, 3),
    steeringWheelAngle: round(steer, 4),
    steeringDeg: round((steer * 180) / Math.PI, 1),
    fuelLevel: round(TANK_CAPACITY * fuelPct, 2),
    fuelLevelPct: round(fuelPct, 3),
    lapCurrentLapTime: round(pct * car.pace, 3),
    lapBestLapTime: round(car.pace - 0.8, 3),
    lapLastLapTime: round(lapTime(car, t), 3),
    lap: Math.floor(prog),
    lapDistPct: round(pct, 4),
    playerCarPosition: null, // standings channel is authoritative
    playerCarClassPosition: null,
    latAccel: round(9 * Math.sin(t * 0.6), 2),
    lonAccel: round(6 * (throttle - brake), 2),
    onPitRoad: false,
    airTemp: 22,
    trackTemp: round(30 + 2 * Math.sin(t * 0.01), 1),
    tyres: {
      lf: corner(85, 0),
      rf: corner(88, 1),
      lr: corner(80, 2),
      rr: corner(82, 3),
    },
  };
}

// ── session ─────────────────────────────────────────────────────────────────

function driverEntry(car: MockCar): DriverEntry {
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
    incidentCount: car.idx % 4,
    isPaceCar: false,
    isSpectator: false,
    isAI: car.isAI,
    isTeamDriver: false,
  };
}

export function mockSession(t: number): SessionInfo {
  const drivers = MOCK_FIELD.map(driverEntry);
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

function emptySectors(): SectorSplit[] {
  return [0, 1, 2].map((index) => ({
    index,
    lastTime: null,
    bestTime: null,
    delta: null,
    status: "none" as const,
  }));
}

export function mockStandings(t: number): StandingsPayload {
  const ordered = [...MOCK_FIELD].sort((a, b) => progress(b, t) - progress(a, t));
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
    return {
      carIdx: car.idx,
      position: pos,
      classPosition: classPos.get(car.idx) ?? null,
      carClassId: car.klass.id,
      lap,
      lapDistPct: round(pct, 4),
      lastLapTime: round(lapTime(car, t), 3),
      bestLapTime: round(car.pace - 0.8, 3),
      gapToLeader: round(Math.max(0, gap), 3),
      interval: null,
      gapIsLaps: false,
      lapsDown: 0,
      gapToClassLeader: round(Math.max(0, gap), 3),
      classInterval: null,
      classGapIsLaps: false,
      intervalToPlayer,
      estCatchTime: null,
      positionsGainedTotal: 0,
      positionsGainedLastLap: 0,
      iRating: car.iRating,
      iRatingChangeEst: 0,
      lastLapStatus: "normal",
      sectors: emptySectors(),
      theoreticalBest: null,
      onPitRoad: false,
      trackSurfaceLabel: "OnTrack",
      isOffTrack: false,
      isInPitStall: false,
      isInWorld: true,
      isRetired: false,
      isPlayer: car.idx === MOCK_PLAYER_IDX,
      isOverallLeader: pos === 1,
      isClassLeader: classPos.get(car.idx) === 1,
      isLapped: false,
      tireCompound: 0,
      tireLaps: lap,
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
