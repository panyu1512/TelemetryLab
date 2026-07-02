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

/** A computed standings row: driver + timing joined with derived gaps. */
export interface StandingsEntry {
  carIdx: number;
  position: number | null;
  classPosition: number | null;
  carClassId: number;
  lap: number | null;
  lapDistPct: number | null;
  lastLapTime: number | null;
  bestLapTime: number | null;
  /** Seconds behind the leader, or a lap count when `gapIsLaps` is true. */
  gapToLeader: number | null;
  /** Seconds to the car directly ahead. */
  interval: number | null;
  gapIsLaps: boolean;
  onPitRoad: boolean | null;
  trackSurfaceLabel: string;
  isPlayer: boolean;
}

export interface StandingsPayload {
  playerCarIdx: number;
  entries: StandingsEntry[];
}

/** Bridge/iRacing connection status (bridge channel). */
export interface BridgeStatus {
  iracingActive: boolean;
}
