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
from typing import Any

from .enums import decode_flags, session_state
from .models import (
    ClassEntry,
    DriverEntry,
    SessionInfo,
    TrackInfo,
    WeatherInfo,
)
from .sectors import parse_sector_starts


def _is_unlimited(value: Any) -> bool:
    """iRacing marks an untimed/unlimited SessionTime/SessionLaps as
    ``"unlimited"`` (and occasionally as a missing/blank value)."""
    return value is None or str(value).strip().lower() in {"unlimited", ""}


def _num(value: Any) -> float | None:
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


# Every manufacturer that appears in an iRacing car screen name. The name is
# the only place a make is recorded — iRacing exposes no make field — and it
# does not reliably *start* with one: road cars do ("Audi R8 LMS EVO II") but
# anything with a series prefix does not ("NASCAR Cup Series Ford Mustang",
# "Supercars Holden ZB Commodore", "Global Mazda MX-5 Cup"). Taking the first
# word therefore mislabelled roughly a quarter of the roster — all of oval
# racing — as "NASCAR"/"ARCA"/"Supercars", so the frontend drew a three-letter
# fallback for cars whose brand mark it already had.
#
# Spelling matters: these strings are the frontend's icon keys (see
# BRAND_ICONS in src/components/standings/cells.tsx), so "Mercedes-AMG" is
# hyphenated and "Aston Martin" keeps its space.
_CAR_MAKES = (
    "Acura",
    "Aston Martin",
    "Audi",
    "BMW",
    "Buick",
    "Cadillac",
    "Chevrolet",
    "Dallara",
    "Ferrari",
    "Ford",
    "Holden",
    "Honda",
    "HPD",
    "Hyundai",
    "Kia",
    "Lamborghini",
    "Ligier",
    "Lotus",
    "Mazda",
    "McLaren",
    "Mercedes-AMG",
    "Mercedes",
    "Nissan",
    "Pontiac",
    "Porsche",
    "Radical",
    "RAM",
    "Ray",
    "Renault",
    "Riley",
    "Ruf",
    "Subaru",
    "Toyota",
    "Volkswagen",
    "VW",
    "Williams",
)

# Word-bounded so "Ray" doesn't fire inside "Racing" and "RAM" doesn't fire
# inside a model code. Longest-first so "Mercedes-AMG" wins over "Mercedes"
# and "Aston Martin" over nothing at all.
_MAKE_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(m) for m in sorted(_CAR_MAKES, key=len, reverse=True)) + r")\b",
    re.IGNORECASE,
)

# Canonical casing, keyed by the lowercased match.
_MAKE_CANONICAL = {m.lower(): m for m in _CAR_MAKES}


def _car_make(screen_name: str) -> str:
    """Best-effort manufacturer from the car's screen name.

    Scans for the first known make anywhere in the name rather than assuming it
    leads. "First" is deliberate: where two makes appear, the leading one is the
    chassis or entrant and the one that belongs on the car — "McLaren Honda
    MP4-30" is a McLaren, and "Super Formula SF23 - Honda" (engine only) still
    resolves to Honda because nothing precedes it.

    Falls back to the first word for anything unrecognised, so a car added to
    iRacing after this list was written still yields a usable label rather than
    an empty one.
    """
    name = (screen_name or "").strip()
    if not name:
        return ""
    match = _MAKE_PATTERN.search(name)
    if match:
        return _MAKE_CANONICAL[match.group(1).lower()]
    return name.split(" ", 1)[0]


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
                country_code=str(d.get("FlairShortName", "") or "").upper(),
                country_name=str(d.get("FlairName", "") or ""),
                division=_int(d.get("DivisionName"), 0),
                incident_count=_int(d.get("CurDriverIncidentCount"), 0),
                is_pace_car=_bool(d.get("CarIsPaceCar"))
                or car_idx == _int(driver_info.get("PaceCarIdx"), -1),
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

#: iRacing's "unlimited / not applicable" value for both laps-remaining
#: channels. It is a real 32767 in the buffer, not a null.
LAPS_SENTINEL = 32767


def _laps_remain(raw: dict[str, Any]) -> int | None:
    """Laps left in the session, preferring iRacing's own prediction.

    Two channels carry this and they are not equivalent:

    ``SessionLapsRemain``
        Exact in a lap-limited race; the sentinel in a timed one, because the
        lap count genuinely is not known yet.
    ``SessionLapsRemainEx``
        The SDK's improved version. In a timed race it holds iRacing's
        *predicted* total, derived from the leader's pace — which is the number
        the sim's own AutoFuel fuels against.

    Preferring ``Ex`` is what stops the fuel screen estimating a timed race's
    length from the player's own lap time. That estimate is wrong for everyone
    slower than the leader: the flag falls when the *leader* runs the clock out,
    so a driver a few seconds off the pace is quoted fewer laps than the race
    will actually run, and fuels short by exactly that error.

    Either channel may be missing (an older SDK, or a session that has not
    started), so this falls through to the plain one and then to ``None``.
    """
    for key in ("session_laps_remain_ex", "session_laps_remain"):
        n = _num(raw.get(key))
        # Missing, the sentinel, or negative (which shows up between sessions):
        # not a lap count, so fall through rather than believing it.
        if n is None or int(n) == LAPS_SENTINEL or n < 0:
            continue
        return int(n)
    return None


def parse_session_info(raw: dict[str, Any]) -> SessionInfo:
    """Assemble a :class:`SessionInfo` from a raw source snapshot.

    ``raw`` keys (all optional, missing → sensible defaults):
      weekend_info, driver_info, sessions (the ``SessionInfo['Sessions']`` list),
      session_num, session_time_remain, session_laps_remain,
      session_laps_remain_ex, session_flags,
      air_temp, track_temp, car_redline_rpm, car_est_lap_time.
    """
    weekend: dict[str, Any] = raw.get("weekend_info") or {}
    driver_info: dict[str, Any] = raw.get("driver_info") or {}
    sessions: list[dict[str, Any]] = raw.get("sessions") or []
    session_num = _int(raw.get("session_num"), 0)
    sector_starts = parse_sector_starts(raw.get("split_time_info"))

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
        air_temp=_num(raw.get("air_temp"))
        if raw.get("air_temp") is not None
        else _num(weekend.get("TrackAirTemp")),
        track_temp=_num(raw.get("track_temp"))
        if raw.get("track_temp") is not None
        else _num(weekend.get("TrackSurfaceTemp")),
        skies=str(weekend.get("TrackSkies")) if weekend.get("TrackSkies") else None,
        track_wetness=str(weekend.get("TrackWeatherType"))
        if weekend.get("TrackWeatherType")
        else None,
    )

    flags_raw = _int(raw.get("session_flags"), 0)
    sub_session = _int(weekend.get("SubSessionID"), 0)

    overall_sof = strength_of_field(
        [d.i_rating for d in drivers if not d.is_pace_car and not d.is_spectator]
    )

    return SessionInfo(
        session_id=f"{sub_session}:{track.track_id}:{session_num}",
        session_num=session_num,
        session_type=str(current.get("SessionType", "") or ""),
        session_name=str(current.get("SessionName", "") or ""),
        session_state=_int(raw.get("session_state"), 0),
        session_state_label=session_state(_int(raw.get("session_state"), 0)),
        session_time_remain=_num(raw.get("session_time_remain")),
        session_laps_remain=_laps_remain(raw),
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
        sector_starts=sector_starts,
    )
