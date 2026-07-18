/**
 * TypeScript mirror of the bridge's normalized models
 * (`bridge/telemetrylab/models.py`). These MUST be kept in lockstep: the Python
 * `to_dict()` methods emit exactly these camelCase shapes.
 *
 * The split mirrors the WebSocket channels:
 *   - `PlayerTelemetry` → `telemetry` channel (~60 Hz)
 *   - `SessionInfo`     → `session`   channel (on change / ~1 Hz)
 *   - `StandingsPayload`→ `standings` channel (~5–10 Hz)
 *
 * Raw SDK values are preserved alongside derived, presentation-friendly fields
 * (e.g. `trackSurface` + `trackSurfaceLabel`) so the UI can build rich visual
 * state — colors, badges, animations — without any extra backend work.
 */

// ---------------------------------------------------------------------------
// Player telemetry (telemetry channel)
// ---------------------------------------------------------------------------

/** Per-tyre carcass temperatures (left/middle/right) and pressure. */
export interface TyreData {
  tempL: number | null;
  tempM: number | null;
  tempR: number | null;
  pressure: number | null;
}

export interface TyreSet {
  lf: TyreData;
  rf: TyreData;
  lr: TyreData;
  rr: TyreData;
}

/** Player-car telemetry frame — the high-frequency payload. */
export interface PlayerTelemetry {
  sessionTime: number | null;

  speed: number | null;
  speedKmh: number | null;
  rpm: number | null;
  /** Gear: -1 reverse, 0 neutral, 1..n forward. */
  gear: number | null;
  throttle: number | null;
  brake: number | null;

  steeringWheelAngle: number | null;
  steeringDeg: number | null;

  fuelLevel: number | null;
  fuelLevelPct: number | null;

  lapCurrentLapTime: number | null;
  lapBestLapTime: number | null;
  lapLastLapTime: number | null;
  lap: number | null;
  lapDistPct: number | null;
  playerCarPosition: number | null;
  playerCarClassPosition: number | null;

  latAccel: number | null;
  lonAccel: number | null;

  onPitRoad: boolean | null;

  airTemp: number | null;
  trackTemp: number | null;

  tyres: TyreSet;
}

// ---------------------------------------------------------------------------
// Driver roster + session (session channel)
// ---------------------------------------------------------------------------

/** One car/driver in the field. Static-ish; changes on driver swaps. */
export interface DriverEntry {
  carIdx: number;
  userId: number;
  userName: string;
  teamName: string;
  carNumber: string;
  carClassId: number;
  carClassShortName: string;
  carPath: string;
  carMake: string;
  carModel: string;
  carScreenName: string;
  iRating: number;
  licenseLevel: number;
  licenseString: string;
  /** Class letter: A/B/C/D/R/P. */
  licenseGroup: string;
  /** Session discipline: road/oval/dirt_road/dirt_oval. */
  licenseCategory: string;
  safetyRating: number;
  /** CSS hex, e.g. "#00ff88". */
  licenseColor: string;
  carClassColor: string;
  clubName: string;
  /** ISO alpha-3 country code from the driver's flair (e.g. "ESP"), "" if unset. */
  countryCode: string;
  /** Country display name (e.g. "Spain"), "" if unset. */
  countryName: string;
  division: number;
  incidentCount: number;
  isPaceCar: boolean;
  isSpectator: boolean;
  isAI: boolean;
  isTeamDriver: boolean;
}

export interface TrackInfo {
  trackId: number;
  name: string;
  config: string;
  city: string;
  country: string;
  lengthKm: number | null;
  numTurns: number | null;
}

export interface WeatherInfo {
  airTemp: number | null;
  trackTemp: number | null;
  skies: string | null;
  trackWetness: string | null;
}

export interface ClassEntry {
  carClassId: number;
  shortName: string;
  color: string;
  sof: number;
  carCount: number;
}

export interface SessionInfo {
  sessionId: string;
  sessionNum: number;
  sessionType: string;
  sessionName: string;
  sessionState: number;
  sessionStateLabel: string;
  /** Seconds remaining; null = unlimited. */
  sessionTimeRemain: number | null;
  /** Laps remaining; null = timed / unlimited. */
  sessionLapsRemain: number | null;
  sessionTimeTotal: number | null;
  sessionLapsTotal: number | null;
  isTimed: boolean;
  /** Active flag names, decoded from the SessionFlags bitmask. */
  flags: string[];
  flagsRaw: number;
  category: string;
  /** Overall strength of field across the whole grid. */
  sof: number;
  track: TrackInfo;
  weather: WeatherInfo;
  classes: ClassEntry[];
  drivers: DriverEntry[];
  driverCarIdx: number;
  carRedlineRpm: number | null;
  carEstLapTime: number | null;
  /** Sector boundaries as lap-distance fractions (from SplitTimeInfo). */
  sectorStarts: number[];
}

// ---------------------------------------------------------------------------
// Per-car timing + standings (standings channel)
// ---------------------------------------------------------------------------

/** Live timing for one car (from the CarIdx* arrays). */
export interface CarTiming {
  carIdx: number;
  position: number | null;
  classPosition: number | null;
  lap: number | null;
  lapDistPct: number | null;
  lastLapTime: number | null;
  bestLapTime: number | null;
  estimatedLapTime: number | null;
  f2Time: number | null;
  /** Relative gap to the player in seconds (negative = behind). */
  deltaToPlayer: number | null;
  onPitRoad: boolean | null;
  trackSurface: number | null;
  trackSurfaceLabel: string;
  timestamp: number;
}

/**
 * How a sector/lap time grades against the bests — drives the timing screen's
 * purple / green / yellow / red colouring (and future colour-transition anims).
 */
export type SectorStatus =
  | "overall_best" // purple — fastest in the field this session
  | "personal_best" // green — this car's own best
  | "slower" // yellow — off personal best
  | "much_slower" // red — a big time loss
  | "none";

/** One derived sector split for a car (see the bridge's `sectors` module). */
export interface SectorSplit {
  index: number;
  /** Last completed sector time (s), or null if not yet timed. */
  lastTime: number | null;
  /** This car's personal best for the sector (s). */
  bestTime: number | null;
  /** Signed delta vs personal best (negative = new best). */
  delta: number | null;
  status: SectorStatus;
}

/** Grade of a car's last full lap (fastest-lap highlight). */
export type LapStatus = "overall_best" | "personal_best" | "normal" | "none";

/**
 * A computed standings row: driver + timing joined with every derived value the
 * timing screen renders. Which fields are direct from iRacing vs derived by the
 * bridge is documented in `docs/standings-architecture.md`.
 */
export interface StandingsEntry {
  carIdx: number;
  position: number | null;
  classPosition: number | null;
  carClassId: number;
  lap: number | null;
  lapDistPct: number | null;
  lastLapTime: number | null;
  bestLapTime: number | null;

  // Gaps.
  /** Seconds behind the leader, or a lap count when `gapIsLaps` is true. */
  gapToLeader: number | null;
  /** Seconds to the car directly ahead. */
  interval: number | null;
  gapIsLaps: boolean;
  lapsDown: number;
  /** Gap to the *class* leader (seconds, or a lap count when classGapIsLaps). */
  gapToClassLeader: number | null;
  /** Interval to the car ahead *in class* (seconds). */
  classInterval: number | null;
  classGapIsLaps: boolean;
  /** Signed est-time gap to the player (negative = behind the player). */
  intervalToPlayer: number | null;
  /** Estimated seconds to catch the car ahead at the current pace delta. */
  estCatchTime: number | null;

  // Position change engine.
  positionsGainedTotal: number;
  positionsGainedLastLap: number;

  // Rating (projection).
  iRating: number;
  /** Live projected iRating change — an estimate, not iRacing's exact number. */
  iRatingChangeEst: number;

  // Lap / sector colouring.
  lastLapStatus: LapStatus;
  sectors: SectorSplit[];
  /** Sum of personal best sectors (ideal lap), or null until all are set. */
  theoreticalBest: number | null;

  // Special states.
  onPitRoad: boolean | null;
  trackSurfaceLabel: string;
  isOffTrack: boolean;
  isInPitStall: boolean;
  isInWorld: boolean;
  isRetired: boolean;
  isPlayer: boolean;
  isOverallLeader: boolean;
  isClassLeader: boolean;
  isLapped: boolean;

  /** Raw CarIdxTireCompound value (series-specific; 0 = primary, 1 = alternate). */
  tireCompound: number | null;
  /** Laps on the current tyre set (derived: counts from last pit-stall exit). */
  tireLaps: number;
}

/** Per-class grouping metadata for the multi-class timing screen. */
export interface ClassStanding {
  carClassId: number;
  shortName: string;
  color: string;
  sof: number;
  carCount: number;
  leaderCarIdx: number | null;
  leaderLap: number | null;
  fastestLap: number | null;
  fastestLapCarIdx: number | null;
  /** carIdx sequence within the class, in class-position order. */
  order: number[];
}

export interface StandingsPayload {
  playerCarIdx: number;
  sectorCount: number;
  overallBestLap: number | null;
  overallBestLapCarIdx: number | null;
  /** Field-best time per sector index (purple reference). */
  overallBestSectors: (number | null)[];
  classes: ClassStanding[];
  entries: StandingsEntry[];
}

/** Bridge/iRacing connection status (bridge channel). */
export interface BridgeStatus {
  iracingActive: boolean;
}
