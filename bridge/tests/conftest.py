"""Shared pytest fixtures and factories for the bridge test suite.

These builders mirror the shapes iRacing / the mock feed the parser and ingest
layers, so individual tests can assemble a realistic-but-minimal snapshot
without repeating the boilerplate. Keep them faithful to the real SDK field
names — the whole point of the bridge is that both sources produce identical
dict shapes.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import pytest

# Make the ``telemetrylab`` package importable when pytest is run from anywhere.
BRIDGE_ROOT = Path(__file__).resolve().parent.parent
if str(BRIDGE_ROOT) not in sys.path:
    sys.path.insert(0, str(BRIDGE_ROOT))


def make_driver(
    car_idx: int,
    *,
    user_id: int | None = None,
    user_name: str = "Driver",
    car_class_id: int = 100,
    car_class_short_name: str = "GT3",
    car_class_color: Any = 0x00FF88,
    i_rating: int = 2500,
    lic_string: str = "A 3.45",
    lic_sublevel: int = 345,
    car_number: str = "7",
    screen_name: str = "Audi R8 LMS EVO II",
    is_pace_car: bool = False,
    is_spectator: bool = False,
    is_ai: bool = False,
    team_id: int = 0,
    **extra: Any,
) -> dict[str, Any]:
    """Build one ``DriverInfo['Drivers']`` entry."""
    driver = {
        "CarIdx": car_idx,
        "UserID": user_id if user_id is not None else 1000 + car_idx,
        "UserName": user_name,
        "TeamName": "",
        "CarNumber": car_number,
        "CarClassID": car_class_id,
        "CarClassShortName": car_class_short_name,
        "CarClassColor": car_class_color,
        "CarPath": "audi_r8_lms_evo_ii",
        "CarScreenName": screen_name,
        "IRating": i_rating,
        "LicLevel": 12,
        "LicString": lic_string,
        "LicSubLevel": lic_sublevel,
        "LicColor": 0xFFFFFF,
        "ClubName": "Iberia",
        "DivisionName": 3,
        "CurDriverIncidentCount": 0,
        "CarIsPaceCar": 1 if is_pace_car else 0,
        "IsSpectator": 1 if is_spectator else 0,
        "CarIsAI": 1 if is_ai else 0,
        "TeamID": team_id,
    }
    driver.update(extra)
    return driver


def make_session_raw(
    *,
    drivers: list[dict[str, Any]] | None = None,
    sessions: list[dict[str, Any]] | None = None,
    session_num: int = 0,
    weekend: dict[str, Any] | None = None,
    driver_car_idx: int = 0,
    **extra: Any,
) -> dict[str, Any]:
    """Build a raw snapshot accepted by :func:`parse_session_info`."""
    base_weekend = {
        "TrackID": 42,
        "TrackDisplayName": "Circuit de Barcelona-Catalunya",
        "TrackConfigName": "Grand Prix",
        "TrackCity": "Barcelona",
        "TrackCountry": "Spain",
        "TrackLength": "4.65 km",
        "TrackNumTurns": 16,
        "Category": "Road",
        "SubSessionID": 555,
    }
    if weekend:
        base_weekend.update(weekend)

    raw: dict[str, Any] = {
        "weekend_info": base_weekend,
        "driver_info": {
            "Drivers": drivers if drivers is not None else [make_driver(0)],
            "DriverCarIdx": driver_car_idx,
        },
        "sessions": sessions
        if sessions is not None
        else [{"SessionType": "Race", "SessionName": "RACE", "SessionLaps": 20}],
        "session_num": session_num,
    }
    raw.update(extra)
    return raw


@pytest.fixture
def driver_factory():
    return make_driver


@pytest.fixture
def session_raw_factory():
    return make_session_raw
