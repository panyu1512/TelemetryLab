"""Parse iRacing's session info into normalized models.

iRacing exposes a large YAML "session info" string, split by pyirsdk into
top-level dicts accessible as ``ir['WeekendInfo']``, ``ir['DriverInfo']`` and
``ir['SessionInfo']`` (the list of sessions in the weekend). pyirsdk parses the
YAML for us, so we consume the already-parsed dicts rather than re-parsing the
raw string — that avoids a second YAML pass, a hard ``pyyaml`` dependency in the
mock, and the many quoting quirks of iRacing's YAML.

The mock bridge builds the same dict shapes by hand, so both bridges share this
one parser and produce byte-identical payloads.
"""

from __future__ import annotations

import math
import re
from typing import Any, Optional

from .enums import decode_flags, session_state
from .models import (
    ClassEntry,
    DriverEntry,
    SessionInfo,
    TrackInfo,
    WeatherInfo,
)

def _is_unlimited(value: Any) -> bool:
    """iRacing marks an untimed/unlimited SessionTime/SessionLaps as
    ``"unlimited"`` (and occasionally as a missing/blank value)."""
    return value is None or str(value).strip().lower() in {"unlimited", ""}


def _num(value: Any) -> Optional[float]:
    """Coerce iRacing's numeric-ish values (may be str with units) to float."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        m = re.search(r"-?\d+(?:\.\d+)?", value)
        return float(m.group()) if m else None
    return None


def _int(value: Any, default: int = 0) -> int:
    n = _num(value)
    return int(n) if n is not None else default


def _bool(value: Any) -> bool:
    return bool(_int(value, 0)) if not isinstance(value, bool) else value


def _hex_color(value: Any) -> str:
    """Normalize an iRacing color (int, ``0xRRGGBB`` or ``#rrggbb``) to CSS hex."""
    if value is None:
        return "#ffffff"
    if isinstance(value, int):
        return f"#{value & 0xFFFFFF:06x}"
    s = str(value).strip().lstrip("#").lower()
    if s.startswith("0x"):
        s = s[2:]
    try:
        return f"#{int(s, 16) & 0xFFFFFF:06x}"
    except ValueError:
        return "#ffffff"


def _license_group(lic_string: str) -> str:
    """Extract the class letter (A/B/C/D/R/P) from e.g. ``"A 3.45"``."""
    token = (lic_string or "").strip().split(" ", 1)[0].upper()
    return token[:1] if token else "R"


def _car_make(screen_name: str) -> str:
    """Best-effort make from the car's screen name (first word).

    iRacing has no explicit make field; the screen name reliably starts with the
    manufacturer (e.g. "Audi R8 LMS EVO II"). The frontend can map makes to logo
    assets; keeping the raw ``carScreenName`` lets it refine this later.
    """
    return (screen_name or "").strip().split(" ", 1)[0]


# ---------------------------------------------------------------------------
# Strength of Field
# ---------------------------------------------------------------------------
def strength_of_field(iratings: list[int]) -> int:
    """iRacing-style Strength of Field for a set of iRatings.

    Uses the community-standard exponential model (Bradley–Terry with
    ``B = 1600/ln 2``), which closely tracks the SOF iRacing publishes. Falls
    back to the arithmetic mean for degenerate inputs.
    """
    valid = [ir for ir in iratings if ir and ir > 0]
    if not valid:
        return 0
    B = 1600.0 / math.log(2.0)
    try:
        denom = sum(math.exp(-ir / B) for ir in valid)
        if denom <= 0:
            raise ValueError
        return int(round(B * math.log(len(valid) / denom)))
    except (ValueError, OverflowError):
        return int(round(sum(valid) / len(valid)))


# ---------------------------------------------------------------------------
# DriverInfo → roster
# ---------------------------------------------------------------------------
def parse_drivers(driver_info: dict[str, Any], category: str) -> list[DriverEntry]:
    """Build the driver roster from the ``DriverInfo`` section.

    Pace cars and empty slots are kept (they occupy a ``CarIdx``) but flagged, so
    downstream code can decide whether to show them. The player is identifiable
    via ``SessionInfo.driver_car_idx``.
    """
    drivers: list[DriverEntry] = []
    for d in driver_info.get("Drivers", []) or []:
        car_idx = _int(d.get("CarIdx"), -1)
        if car_idx < 0:
            continue
        lic_string = str(d.get("LicString", "") or "")
        screen_name = str(d.get("CarScreenName", "") or "")
        team_id = _int(d.get("TeamID"), 0)
        drivers.append(
            DriverEntry(
                car_idx=car_idx,
                user_id=_int(d.get("UserID"), 0),
                user_name=str(d.get("UserName", "") or ""),
                team_name=str(d.get("TeamName", "") or ""),
                car_number=str(d.get("CarNumber", "") or "").strip("\"'"),
                car_class_id=_int(d.get("CarClassID"), 0),
                car_class_short_name=str(d.get("CarClassShortName", "") or ""),
                car_path=str(d.get("CarPath", "") or ""),
                car_make=_car_make(screen_name),
                car_model=screen_name,
                car_screen_name=screen_name,
                i_rating=_int(d.get("IRating"), 0),
                license_level=_int(d.get("LicLevel"), 0),
                license_string=lic_string,
                license_group=_license_group(lic_string),
                license_category=category,
                safety_rating=round(_int(d.get("LicSubLevel"), 0) / 100.0, 2),
                license_color=_hex_color(d.get("LicColor")),
                car_class_color=_hex_color(d.get("CarClassColor")),
                club_name=str(d.get("ClubName", "") or ""),
                division=_int(d.get("DivisionName"), 0),
                incident_count=_int(d.get("CurDriverIncidentCount"), 0),
                is_pace_car=_bool(d.get("CarIsPaceCar")) or car_idx == _int(
                    driver_info.get("PaceCarIdx"), -1
                ),
                is_spectator=_bool(d.get("IsSpectator")),
                is_ai=_bool(d.get("CarIsAI")),
                is_team_driver=team_id > 0,
            )
        )
    return drivers


def _build_classes(drivers: list[DriverEntry]) -> list[ClassEntry]:
    """Group the roster by car class and compute a per-class SOF."""
    buckets: dict[int, list[DriverEntry]] = {}
    for d in drivers:
        if d.is_pace_car or d.is_spectator:
            continue
        buckets.setdefault(d.car_class_id, []).append(d)

    classes: list[ClassEntry] = []
    for class_id, members in buckets.items():
        first = members[0]
        classes.append(
            ClassEntry(
                car_class_id=class_id,
                short_name=first.car_class_short_name,
                color=first.car_class_color,
                sof=strength_of_field([m.i_rating for m in members]),
                car_count=len(members),
            )
        )
    # Strongest class first — matches how multi-class grids are usually stacked.
    classes.sort(key=lambda c: c.sof, reverse=True)
    return classes


# ---------------------------------------------------------------------------
# Weekend + session → SessionInfo
# ---------------------------------------------------------------------------
def parse_session_info(raw: dict[str, Any]) -> SessionInfo:
    """Assemble a :class:`SessionInfo` from a raw source snapshot.

    ``raw`` keys (all optional, missing → sensible defaults):
      weekend_info, driver_info, sessions (the ``SessionInfo['Sessions']`` list),
      session_num, session_time_remain, session_laps_remain, session_flags,
      air_temp, track_temp, car_redline_rpm, car_est_lap_time.
    """
    weekend: dict[str, Any] = raw.get("weekend_info") or {}
    driver_info: dict[str, Any] = raw.get("driver_info") or {}
    sessions: list[dict[str, Any]] = raw.get("sessions") or []
    session_num = _int(raw.get("session_num"), 0)

    category = str(weekend.get("Category", "") or "").lower().replace(" ", "_")
    drivers = parse_drivers(driver_info, category)
    classes = _build_classes(drivers)

    current = (
        sessions[session_num]
        if 0 <= session_num < len(sessions)
        else (sessions[-1] if sessions else {})
    )

    laps_total_raw = current.get("SessionLaps")
    time_total_raw = current.get("SessionTime")
    laps_total = None if _is_unlimited(laps_total_raw) else _int(laps_total_raw)
    time_total = None if _is_unlimited(time_total_raw) else _num(time_total_raw)
    is_timed = time_total is not None or laps_total is None

    track = TrackInfo(
        track_id=_int(weekend.get("TrackID"), 0),
        name=str(weekend.get("TrackDisplayName") or weekend.get("TrackName", "") or ""),
        config=str(weekend.get("TrackConfigName", "") or ""),
        city=str(weekend.get("TrackCity", "") or ""),
        country=str(weekend.get("TrackCountry", "") or ""),
        length_km=_num(weekend.get("TrackLength")),
        num_turns=(_int(weekend.get("TrackNumTurns")) or None),
    )

    weather = WeatherInfo(
        air_temp=_num(raw.get("air_temp")) if raw.get("air_temp") is not None
        else _num(weekend.get("TrackAirTemp")),
        track_temp=_num(raw.get("track_temp")) if raw.get("track_temp") is not None
        else _num(weekend.get("TrackSurfaceTemp")),
        skies=str(weekend.get("TrackSkies")) if weekend.get("TrackSkies") else None,
        track_wetness=str(weekend.get("TrackWeatherType")) if weekend.get("TrackWeatherType") else None,
    )

    flags_raw = _int(raw.get("session_flags"), 0)
    sub_session = _int(weekend.get("SubSessionID"), 0)

    overall_sof = strength_of_field([d.i_rating for d in drivers
                                     if not d.is_pace_car and not d.is_spectator])

    return SessionInfo(
        session_id=f"{sub_session}:{track.track_id}:{session_num}",
        session_num=session_num,
        session_type=str(current.get("SessionType", "") or ""),
        session_name=str(current.get("SessionName", "") or ""),
        session_state=_int(raw.get("session_state"), 0),
        session_state_label=session_state(_int(raw.get("session_state"), 0)),
        session_time_remain=_num(raw.get("session_time_remain")),
        session_laps_remain=(
            None if raw.get("session_laps_remain") in (None, 32767)
            else _int(raw.get("session_laps_remain"))
        ),
        session_time_total=time_total,
        session_laps_total=laps_total,
        is_timed=is_timed,
        flags=decode_flags(flags_raw),
        flags_raw=flags_raw,
        category=category,
        sof=overall_sof,
        track=track,
        weather=weather,
        classes=classes,
        drivers=drivers,
        driver_car_idx=_int(driver_info.get("DriverCarIdx"), _int(raw.get("player_car_idx"), 0)),
        car_redline_rpm=_num(raw.get("car_redline_rpm"))
        if raw.get("car_redline_rpm") is not None
        else _num(driver_info.get("DriverCarRedLine")),
        car_est_lap_time=_num(raw.get("car_est_lap_time"))
        if raw.get("car_est_lap_time") is not None
        else _num(driver_info.get("DriverCarEstLapTime")),
    )
