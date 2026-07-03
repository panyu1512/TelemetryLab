"""Tests for model dataclasses and their camelCase wire serialization.

The ``to_dict()`` methods are the contract with the TypeScript frontend
(``src/telemetry/types.ts``), so we assert the exact key casing and structure.
"""

from __future__ import annotations

from telemetrylab.models import (
    CarTiming,
    ClassEntry,
    ClassStanding,
    StandingsSnapshot,
    TrackInfo,
    WeatherInfo,
)
from telemetrylab.parsing import parse_drivers, parse_session_info

from .conftest import make_driver, make_session_raw


class TestDriverEntryToDict:
    def test_camelcase_keys(self):
        d = parse_drivers({"Drivers": [make_driver(0)]}, "road")[0]
        wire = d.to_dict()
        assert wire["carIdx"] == 0
        assert wire["iRating"] == 2500
        assert wire["isAI"] is False
        assert "carClassColor" in wire
        # No snake_case leaks.
        assert not any("_" in k for k in wire)


class TestTrackAndWeather:
    def test_track_to_dict(self):
        t = TrackInfo(1, "Spa", "GP", "Stavelot", "Belgium", 7.0, 19)
        assert t.to_dict() == {
            "trackId": 1,
            "name": "Spa",
            "config": "GP",
            "city": "Stavelot",
            "country": "Belgium",
            "lengthKm": 7.0,
            "numTurns": 19,
        }

    def test_weather_nullable(self):
        w = WeatherInfo(None, None, None, None)
        wire = w.to_dict()
        assert wire["airTemp"] is None
        assert set(wire) == {"airTemp", "trackTemp", "skies", "trackWetness"}


class TestClassEntry:
    def test_to_dict(self):
        c = ClassEntry(100, "GT3", "#00ff88", 3200, 12)
        assert c.to_dict() == {
            "carClassId": 100,
            "shortName": "GT3",
            "color": "#00ff88",
            "sof": 3200,
            "carCount": 12,
        }


class TestCarTiming:
    def test_to_dict_roundtrip_keys(self):
        t = CarTiming(
            car_idx=5,
            position=3,
            class_position=2,
            lap=10,
            lap_dist_pct=0.4,
            last_lap_time=92.1,
            best_lap_time=91.0,
            estimated_lap_time=45.0,
            f2_time=1.2,
            delta_to_player=-0.5,
            on_pit_road=False,
            track_surface=3,
            track_surface_label="on_track",
            timestamp=999,
            tire_compound=1,
        )
        wire = t.to_dict()
        assert wire["carIdx"] == 5
        assert wire["deltaToPlayer"] == -0.5
        assert wire["trackSurfaceLabel"] == "on_track"
        assert wire["tireCompound"] == 1
        assert not any("_" in k for k in wire)


class TestSessionInfoToDict:
    def test_full_shape(self):
        session = parse_session_info(make_session_raw())
        wire = session.to_dict()
        assert wire["sessionId"] == "555:42:0"
        assert wire["track"]["name"] == "Circuit de Barcelona-Catalunya"
        assert isinstance(wire["drivers"], list)
        assert isinstance(wire["classes"], list)
        assert "sectorStarts" in wire
        # Nested dicts are also camelCase.
        assert not any("_" in k for k in wire)
        assert not any("_" in k for k in wire["track"])


class TestStandingsSnapshotDefaults:
    def test_empty_defaults(self):
        snap = StandingsSnapshot()
        wire = snap.to_dict()
        assert wire["entries"] == []
        assert wire["classes"] == []
        assert wire["playerCarIdx"] == -1
        assert wire["sectorCount"] == 0


class TestClassStanding:
    def test_to_dict(self):
        cs = ClassStanding(
            car_class_id=1,
            short_name="GT3",
            color="#fff",
            sof=3000,
            car_count=5,
            leader_car_idx=2,
            leader_lap=10,
            fastest_lap=91.2,
            fastest_lap_car_idx=2,
            order=[2, 3, 4],
        )
        wire = cs.to_dict()
        assert wire["carClassId"] == 1
        assert wire["order"] == [2, 3, 4]
        assert wire["fastestLap"] == 91.2
        assert not any("_" in k for k in wire)
