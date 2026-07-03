"""Tests for CarIdx array ingestion into per-car timing."""

from __future__ import annotations

from telemetrylab.ingest import (
    CAR_IDX_VARS,
    _wrap_delta,
    ingest_car_timings,
)


def _arrays(**overrides):
    """A small CarIdx array bundle for 3 cars (indices 0..2)."""
    base = {
        "CarIdxPosition": [1, 2, 3],
        "CarIdxClassPosition": [1, 2, 3],
        "CarIdxLap": [10, 10, 9],
        "CarIdxLapDistPct": [0.5, 0.4, 0.9],
        "CarIdxLastLapTime": [92.1, 92.5, 93.0],
        "CarIdxBestLapTime": [91.0, 91.8, 92.2],
        "CarIdxEstTime": [45.0, 46.0, 80.0],
        "CarIdxF2Time": [0.0, 1.2, 30.0],
        "CarIdxOnPitRoad": [False, False, True],
        "CarIdxTrackSurface": [3, 3, 1],
        "CarIdxTireCompound": [0, 0, 1],
    }
    base.update(overrides)
    return base


class TestWrapDelta:
    def test_no_lap_time_returns_raw(self):
        assert _wrap_delta(5.0, None) == 5.0
        assert _wrap_delta(5.0, 0) == 5.0

    def test_within_half_lap_unchanged(self):
        assert _wrap_delta(10.0, 90.0) == 10.0

    def test_wraps_forward_past_half(self):
        # 80s ahead on a 90s lap is better described as 10s behind.
        assert _wrap_delta(80.0, 90.0) == -10.0

    def test_wraps_backward_past_half(self):
        assert _wrap_delta(-80.0, 90.0) == 10.0


class TestIngestCarTimings:
    def test_builds_entry_per_included_car(self):
        out = ingest_car_timings(
            _arrays(),
            timestamp=1234,
            player_car_idx=0,
            est_lap_time=90.0,
            include=[0, 1, 2],
        )
        assert set(out.keys()) == {0, 1, 2}
        assert out[0].timestamp == 1234

    def test_direct_passthrough_fields(self):
        out = ingest_car_timings(
            _arrays(), timestamp=0, player_car_idx=0, est_lap_time=90.0, include=[1]
        )
        t = out[1]
        assert t.position == 2
        assert t.lap == 10
        assert t.lap_dist_pct == 0.4
        assert t.last_lap_time == 92.5
        assert t.on_pit_road is False
        assert t.track_surface == 3
        assert t.track_surface_label == "on_track"
        assert t.tire_compound == 0

    def test_position_zero_normalized_to_none(self):
        out = ingest_car_timings(
            _arrays(CarIdxPosition=[0, 2, 3]),
            timestamp=0,
            player_car_idx=0,
            est_lap_time=90.0,
            include=[0],
        )
        assert out[0].position is None

    def test_negative_lap_time_is_none(self):
        # iRacing uses -1 for "no valid time".
        out = ingest_car_timings(
            _arrays(CarIdxLastLapTime=[-1.0, 92.5, 93.0]),
            timestamp=0,
            player_car_idx=0,
            est_lap_time=90.0,
            include=[0],
        )
        assert out[0].last_lap_time is None

    def test_player_delta_is_zero(self):
        out = ingest_car_timings(
            _arrays(), timestamp=0, player_car_idx=0, est_lap_time=90.0, include=[0]
        )
        assert out[0].delta_to_player == 0.0

    def test_other_car_delta_computed_and_wrapped(self):
        # Player est 45, car1 est 46 → +1.0 (within half a 90s lap).
        out = ingest_car_timings(
            _arrays(), timestamp=0, player_car_idx=0, est_lap_time=90.0, include=[0, 1]
        )
        assert out[1].delta_to_player == 1.0

    def test_delta_none_when_player_est_missing(self):
        out = ingest_car_timings(
            _arrays(CarIdxEstTime=[-1.0, 46.0, 80.0]),
            timestamp=0,
            player_car_idx=0,
            est_lap_time=90.0,
            include=[1],
        )
        assert out[1].delta_to_player is None

    def test_short_array_yields_none_not_crash(self):
        # Only two cars of data, but three requested — index 2 reads as None.
        out = ingest_car_timings(
            {"CarIdxPosition": [1, 2]},
            timestamp=0,
            player_car_idx=0,
            est_lap_time=90.0,
            include=[0, 1, 2],
        )
        assert out[2].position is None
        assert out[2].track_surface_label == "not_in_world"

    def test_missing_arrays_entirely(self):
        out = ingest_car_timings({}, timestamp=0, player_car_idx=0, est_lap_time=90.0, include=[0])
        t = out[0]
        assert t.position is None
        assert t.lap is None
        assert t.on_pit_road is None

    def test_car_idx_vars_are_declared(self):
        # The read set the SDK requests must include everything ingest reads.
        for var in (
            "CarIdxPosition",
            "CarIdxLap",
            "CarIdxEstTime",
            "CarIdxTireCompound",
        ):
            assert var in CAR_IDX_VARS
