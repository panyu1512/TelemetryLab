"""Normalized telemetry domain models.

These dataclasses are the single source of truth for the *shape* of everything
that crosses the WebSocket. Each has a ``to_dict()`` that emits **camelCase**
keys so the payloads map 1:1 onto the TypeScript interfaces in
``src/telemetry/types.ts`` — the two must be kept in lockstep.

Design notes
------------
- Raw SDK values are preserved (e.g. ``trackSurface`` int) alongside derived,
  presentation-friendly fields (``trackSurfaceLabel``). The frontend can derive
  rich visual state from either without a backend round-trip.
- Everything is nullable-friendly: iRacing does not expose every field in every
  session (offline/AI/replay), so missing data is ``None``, never a fabricated
  zero that would lie to a widget.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


# ---------------------------------------------------------------------------
# Driver roster (from the DriverInfo session YAML)
# ---------------------------------------------------------------------------
@dataclass(slots=True)
class DriverEntry:
    """One entry in the field. Static-ish per stint; changes on driver swaps."""

    car_idx: int
    user_id: int
    user_name: str
    team_name: str
    car_number: str          # kept as string: iRacing numbers can be "01", "007"
    car_class_id: int
    car_class_short_name: str
    car_path: str
    car_make: str
    car_model: str
    car_screen_name: str
    i_rating: int
    license_level: int       # irsdk LicLevel (1..20-ish; maps to R/D/C/B/A/Pro)
    license_string: str      # e.g. "A 3.45"
    license_group: str       # e.g. "A", "B", ... derived from license_string
    license_category: str    # session discipline (road/oval/...), see SessionInfo
    safety_rating: float     # LicSubLevel / 100, e.g. 3.45
    license_color: str       # hex "#rrggbb" for badge tinting
    car_class_color: str     # hex "#rrggbb" for multi-class grouping
    club_name: str
    division: int
    incident_count: int
    is_pace_car: bool
    is_spectator: bool
    is_ai: bool
    is_team_driver: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "carIdx": self.car_idx,
            "userId": self.user_id,
            "userName": self.user_name,
            "teamName": self.team_name,
            "carNumber": self.car_number,
            "carClassId": self.car_class_id,
            "carClassShortName": self.car_class_short_name,
            "carPath": self.car_path,
            "carMake": self.car_make,
            "carModel": self.car_model,
            "carScreenName": self.car_screen_name,
            "iRating": self.i_rating,
            "licenseLevel": self.license_level,
            "licenseString": self.license_string,
            "licenseGroup": self.license_group,
            "licenseCategory": self.license_category,
            "safetyRating": self.safety_rating,
            "licenseColor": self.license_color,
            "carClassColor": self.car_class_color,
            "clubName": self.club_name,
            "division": self.division,
            "incidentCount": self.incident_count,
            "isPaceCar": self.is_pace_car,
            "isSpectator": self.is_spectator,
            "isAI": self.is_ai,
            "isTeamDriver": self.is_team_driver,
        }


# ---------------------------------------------------------------------------
# Session / weekend / weather (SessionInfo channel)
# ---------------------------------------------------------------------------
@dataclass(slots=True)
class TrackInfo:
    track_id: int
    name: str
    config: str
    city: str
    country: str
    length_km: Optional[float]
    num_turns: Optional[int]

    def to_dict(self) -> dict[str, Any]:
        return {
            "trackId": self.track_id,
            "name": self.name,
            "config": self.config,
            "city": self.city,
            "country": self.country,
            "lengthKm": self.length_km,
            "numTurns": self.num_turns,
        }


@dataclass(slots=True)
class WeatherInfo:
    air_temp: Optional[float]
    track_temp: Optional[float]
    skies: Optional[str]
    track_wetness: Optional[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "airTemp": self.air_temp,
            "trackTemp": self.track_temp,
            "skies": self.skies,
            "trackWetness": self.track_wetness,
        }


@dataclass(slots=True)
class ClassEntry:
    """Per-class summary within a (possibly multi-class) session."""

    car_class_id: int
    short_name: str
    color: str
    sof: int          # strength of field for this class
    car_count: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "carClassId": self.car_class_id,
            "shortName": self.short_name,
            "color": self.color,
            "sof": self.sof,
            "carCount": self.car_count,
        }


@dataclass(slots=True)
class SessionInfo:
    """A snapshot of the whole session: what/where/when + the roster."""

    session_id: str            # stable-ish id derived from subsession + track
    session_num: int           # index of the current session in the weekend
    session_type: str          # "Practice" | "Qualify" | "Race" | ...
    session_name: str
    session_state: int
    session_state_label: str
    session_time_remain: Optional[float]   # seconds; None = unlimited
    session_laps_remain: Optional[int]     # None = unlimited / timed
    session_time_total: Optional[float]
    session_laps_total: Optional[int]
    is_timed: bool
    flags: list[str]
    flags_raw: int
    category: str              # road / oval / dirt_road / dirt_oval
    sof: int                   # overall SOF across the field
    track: TrackInfo
    weather: WeatherInfo
    classes: list[ClassEntry]
    drivers: list[DriverEntry]
    driver_car_idx: int        # the player's carIdx (PlayerCarIdx)
    # Self-calibration data that used to be guessed by the frontend:
    car_redline_rpm: Optional[float]
    car_est_lap_time: Optional[float]

    def to_dict(self) -> dict[str, Any]:
        return {
            "sessionId": self.session_id,
            "sessionNum": self.session_num,
            "sessionType": self.session_type,
            "sessionName": self.session_name,
            "sessionState": self.session_state,
            "sessionStateLabel": self.session_state_label,
            "sessionTimeRemain": self.session_time_remain,
            "sessionLapsRemain": self.session_laps_remain,
            "sessionTimeTotal": self.session_time_total,
            "sessionLapsTotal": self.session_laps_total,
            "isTimed": self.is_timed,
            "flags": self.flags,
            "flagsRaw": self.flags_raw,
            "category": self.category,
            "sof": self.sof,
            "track": self.track.to_dict(),
            "weather": self.weather.to_dict(),
            "classes": [c.to_dict() for c in self.classes],
            "drivers": [d.to_dict() for d in self.drivers],
            "driverCarIdx": self.driver_car_idx,
            "carRedlineRpm": self.car_redline_rpm,
            "carEstLapTime": self.car_est_lap_time,
        }


# ---------------------------------------------------------------------------
# Per-car timing (from the CarIdx* arrays) — standings channel
# ---------------------------------------------------------------------------
@dataclass(slots=True)
class CarTiming:
    """Live timing for a single car, keyed by ``car_idx``.

    ``delta_to_player`` is the relative gap (seconds, signed: negative = behind
    the player) used by the relative overlay; it is computed from est-time and
    wrapped around the lap. Standings gaps live on :class:`StandingsEntry`.
    """

    car_idx: int
    position: Optional[int]
    class_position: Optional[int]
    lap: Optional[int]
    lap_dist_pct: Optional[float]
    last_lap_time: Optional[float]
    best_lap_time: Optional[float]
    estimated_lap_time: Optional[float]   # CarIdxEstTime: est time to current pos
    f2_time: Optional[float]              # CarIdxF2Time: sim's gap value
    delta_to_player: Optional[float]
    on_pit_road: Optional[bool]
    track_surface: Optional[int]
    track_surface_label: str
    timestamp: int                        # server ms when sampled

    def to_dict(self) -> dict[str, Any]:
        return {
            "carIdx": self.car_idx,
            "position": self.position,
            "classPosition": self.class_position,
            "lap": self.lap,
            "lapDistPct": self.lap_dist_pct,
            "lastLapTime": self.last_lap_time,
            "bestLapTime": self.best_lap_time,
            "estimatedLapTime": self.estimated_lap_time,
            "f2Time": self.f2_time,
            "deltaToPlayer": self.delta_to_player,
            "onPitRoad": self.on_pit_road,
            "trackSurface": self.track_surface,
            "trackSurfaceLabel": self.track_surface_label,
            "timestamp": self.timestamp,
        }


@dataclass(slots=True)
class StandingsEntry:
    """A row in the computed field order: driver + timing + derived gaps.

    This is the join of :class:`DriverEntry` (static) and :class:`CarTiming`
    (live) plus the derived gap/interval, so the standings channel is fully
    self-contained: the frontend can render a row without cross-referencing the
    session store (though it may, to avoid duplicating the roster).
    """

    car_idx: int
    position: Optional[int]
    class_position: Optional[int]
    car_class_id: int
    lap: Optional[int]
    lap_dist_pct: Optional[float]
    last_lap_time: Optional[float]
    best_lap_time: Optional[float]
    gap_to_leader: Optional[float]        # seconds (or laps, see gap_is_laps)
    interval: Optional[float]             # to the car directly ahead
    gap_is_laps: bool                     # True when lapped (gap is a lap count)
    on_pit_road: Optional[bool]
    track_surface_label: str
    is_player: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "carIdx": self.car_idx,
            "position": self.position,
            "classPosition": self.class_position,
            "carClassId": self.car_class_id,
            "lap": self.lap,
            "lapDistPct": self.lap_dist_pct,
            "lastLapTime": self.last_lap_time,
            "bestLapTime": self.best_lap_time,
            "gapToLeader": self.gap_to_leader,
            "interval": self.interval,
            "gapIsLaps": self.gap_is_laps,
            "onPitRoad": self.on_pit_road,
            "trackSurfaceLabel": self.track_surface_label,
            "isPlayer": self.is_player,
        }


@dataclass(slots=True)
class StandingsSnapshot:
    """The full standings payload: ordered rows + a fingerprint for change
    detection so the publisher can skip identical frames."""

    entries: list[StandingsEntry] = field(default_factory=list)
    player_car_idx: int = -1

    def to_dict(self) -> dict[str, Any]:
        return {
            "playerCarIdx": self.player_car_idx,
            "entries": [e.to_dict() for e in self.entries],
        }
