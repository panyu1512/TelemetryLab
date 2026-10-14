"""The session best: every car's laps timed from lap distance, and the
player's lap held against the fastest one.

Rival cars here drive :mod:`telemetrylab.mocktrack` laps too, sampled at 60 Hz
on the same session clock as the player, so a rival's lap timed from nothing
but ``CarIdxLapDistPct`` can be checked against the lap it actually drove.
"""

from __future__ import annotations

import asyncio
from collections.abc import Iterator
from typing import Any

import pytest

from telemetrylab import mocktrack as mt
from telemetrylab.coaching import Coach, FieldLapTimer, TimedLap, compare_to_best, resample
from telemetrylab.coaching.corners import detect_corners
from telemetrylab.coaching.laps import grid_points
from telemetrylab.protocol import Channel
from telemetrylab.service import BridgeService, class_rivals

from .conftest import lap_frames, make_driver, make_session_raw
from .test_coaching import record

LENGTH = mt.TRACK_LENGTH_M
HZ = 60.0


def pct_at(laps: list[mt.MockLap], t: float) -> float | None:
    """Where a car driving ``laps`` back to back from t=0 is at time ``t``."""
    start = 0.0
    for lap in laps:
        if t < start + lap.lap_time:
            return lap.at_time(t - start)["pct"] % 1.0
        start += lap.lap_time
    return None


def field_frames(
    rivals: dict[int, list[mt.MockLap]],
    seconds: float,
    *,
    surface: Any = None,
    pit: Any = None,
) -> Iterator[tuple[float, dict[str, Any]]]:
    """``(session_time, arrays)`` at 60 Hz for rival cars driving their laps."""
    size = max(rivals) + 1
    t = 0.0
    while t < seconds:
        pcts: list[float | None] = [None] * size
        surf = [3] * size
        pits = [False] * size
        for idx, laps in rivals.items():
            pcts[idx] = pct_at(laps, t)
            if surface is not None:
                s = surface(idx, t, pcts[idx])
                surf[idx] = 3 if s is None else s
            if pit is not None:
                pits[idx] = bool(pit(idx, t, pcts[idx]))
        yield (
            t,
            {
                "CarIdxLapDistPct": [-1.0 if p is None else p for p in pcts],
                "CarIdxTrackSurface": surf,
                "CarIdxOnPitRoad": pits,
                "CarIdxLap": [0] * size,
            },
        )
        t += 1.0 / HZ


def timed(rivals: dict[int, list[mt.MockLap]], seconds: float, **kw: Any) -> list[TimedLap]:
    timer = FieldLapTimer()
    out: list[TimedLap] = []
    for t, arrays in field_frames(rivals, seconds, **kw):
        out.extend(timer.feed(t, arrays, rivals.keys()))
    return out


def total(laps: list[mt.MockLap]) -> float:
    return sum(lap.lap_time for lap in laps)


# ---------------------------------------------------------------------------
# FieldLapTimer
# ---------------------------------------------------------------------------


class TestFieldLapTimer:
    def test_times_whole_laps_only_to_the_frame(self):
        lap = mt.drive_lap()
        laps = timed({1: [lap] * 4}, total([lap] * 3) + 0.2)
        # The car sits on the line at t=0 with no frame before it, so its first
        # crossing is at the end of lap 1: laps 2 and 3 are timed.
        assert len(laps) == 2
        for timed_lap in laps:
            assert timed_lap.car_idx == 1
            assert timed_lap.lap_time == pytest.approx(lap.lap_time, abs=0.002)
            assert timed_lap.t[0] == 0.0
            assert timed_lap.t[-1] == timed_lap.lap_time

    def test_the_time_at_every_point_is_the_lap_actually_driven(self):
        lap = mt.drive_lap()
        (first, *_) = timed({1: [lap] * 4}, total([lap] * 3) + 0.2)
        for pct in (0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.99):
            x = pct * lap.metres
            i = int(x)
            driven = lap.t[i] + (lap.t[i + 1] - lap.t[i]) * (x - i)
            assert first.time_at(pct) == pytest.approx(driven, abs=0.005)

    def test_a_partial_first_lap_is_never_timed(self):
        lap = mt.drive_lap()
        timer = FieldLapTimer()
        out = []
        for t, arrays in field_frames({1: [lap] * 3}, total([lap] * 2) + 0.2):
            if t < 20.0:
                continue  # joined mid-lap
            out.extend(timer.feed(t, arrays, [1]))
        assert len(out) == 1

    @pytest.mark.parametrize(
        "kw",
        [
            {"surface": lambda idx, t, p: 0 if p and 0.5 < p < 0.502 else None},  # off track
            {"surface": lambda idx, t, p: 2 if p and p > 0.97 else None},  # into the pits
            {"pit": lambda idx, t, p: p and 0.3 < p < 0.31},  # pit road
        ],
    )
    def test_a_lap_off_the_racing_surface_is_not_clean(self, kw):
        lap = mt.drive_lap()
        # The rule matches on every lap, so no lap comes out clean.
        assert timed({1: [lap] * 4}, total([lap] * 3) + 0.2, **kw) == []

    def test_a_teleport_is_not_a_lap(self):
        lap = mt.drive_lap()
        timer = FieldLapTimer()
        out = []
        for t, arrays in field_frames({1: [lap] * 4}, total([lap] * 3) + 0.2):
            if lap.lap_time + 30.0 < t < lap.lap_time + 30.05:
                arrays["CarIdxLapDistPct"][1] += 0.3  # towed forwards
            out.extend(timer.feed(t, arrays, [1]))
        assert [round(x.lap_time) for x in out] == [round(lap.lap_time)]

    def test_leaving_the_world_drops_the_lap_in_flight(self):
        lap = mt.drive_lap()
        timer = FieldLapTimer()
        out = []
        for t, arrays in field_frames({1: [lap] * 4}, total([lap] * 3) + 0.2):
            if lap.lap_time + 30.0 < t < lap.lap_time + 31.0:
                arrays["CarIdxLapDistPct"][1] = -1.0
            out.extend(timer.feed(t, arrays, [1]))
        assert len(out) == 1  # the lap after it only

    def test_cars_dropped_from_the_list_are_forgotten(self):
        lap = mt.drive_lap()
        timer = FieldLapTimer()
        out = []
        for t, arrays in field_frames({1: [lap] * 4}, total([lap] * 3) + 0.2):
            cars = [] if lap.lap_time + 30.0 < t < lap.lap_time + 31.0 else [1]
            out.extend(timer.feed(t, arrays, cars))
        assert len(out) == 1

    def test_repeated_frames_and_a_clock_running_backwards(self):
        timer = FieldLapTimer()
        arrays = {"CarIdxLapDistPct": [0.95, 0.95]}
        assert timer.feed(10.0, arrays, [1]) == []
        assert timer.feed(10.0, arrays, [1]) == []  # repeated: ignored
        assert timer.feed(None, arrays, [1]) == []  # no clock: ignored
        timer.feed(10.1, {"CarIdxLapDistPct": [0.0, 0.01]}, [1])  # over the line
        assert timer._laps  # a lap in flight
        timer.feed(2.0, arrays, [1])  # a new session
        assert timer._laps == {}

    def test_missing_arrays_time_nothing(self):
        timer = FieldLapTimer()
        for i in range(10):
            assert timer.feed(float(i), {}, [1, 2]) == []
            assert timer.feed(float(i) + 0.5, {"CarIdxLapDistPct": "junk"}, [1]) == []


# ---------------------------------------------------------------------------
# compare_to_best
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def player_laps():
    clean = mt.drive_lap()
    slow = mt.drive_lap({2: mt.Mistake(apex_slow_kmh=10)})
    recorded = record([clean, clean, slow, clean])
    n = grid_points(LENGTH)
    return [resample(r, n) for r in recorded]


class TestCompareToBest:
    def test_gaps_add_up_to_the_lap_delta_and_find_the_corner(self, player_laps):
        ref, slow = player_laps[0], player_laps[1]
        corners = detect_corners(ref, LENGTH)
        best = TimedLap(car_idx=3, lap=4, lap_time=ref.lap_time, t=list(ref.t))
        gaps = compare_to_best(slow, best, corners)
        assert sum(g.time_lost for g in gaps) == pytest.approx(slow.lap_time - ref.lap_time)
        worst = max(gaps, key=lambda g: g.time_lost)
        assert worst.corner == 3
        assert worst.to_dict() == {"corner": 3, "timeLost": round(worst.time_lost, 3)}

    def test_a_lap_against_itself_is_even(self, player_laps):
        ref = player_laps[0]
        corners = detect_corners(ref, LENGTH)
        same = TimedLap(car_idx=0, lap=1, lap_time=ref.lap_time, t=list(ref.t))
        assert all(abs(g.time_lost) < 1e-9 for g in compare_to_best(ref, same, corners))

    def test_a_single_corner_track_and_no_corners(self, player_laps):
        ref = player_laps[0]
        (one, *_) = detect_corners(ref, LENGTH)
        best = TimedLap(car_idx=1, lap=1, lap_time=ref.lap_time - 1.0, t=[0.0, ref.lap_time - 1])
        (gap,) = compare_to_best(ref, best, [one])
        assert gap.time_lost == pytest.approx(1.0)
        assert compare_to_best(ref, best, []) == []


# ---------------------------------------------------------------------------
# The coach with a session best
# ---------------------------------------------------------------------------


def drive_session(
    coach: Coach,
    player: list[mt.MockLap],
    rivals: dict[int, list[mt.MockLap]],
) -> tuple[list[dict], int]:
    """Player and rivals on one clock; returns the coach's snapshots and best moves."""
    snaps: list[dict] = []
    moves = 0
    rival_frames = field_frames(rivals, total(player) + 1.0)
    for frame in lap_frames(player):
        t, arrays = next(rival_frames)
        assert t == pytest.approx(frame["sessionTime"])
        if coach.feed_field(frame["sessionTime"], arrays, [0, *rivals], 0):
            moves += 1
        snap = coach.feed(frame)
        if snap is not None:
            snaps.append(snap.to_dict())
    return snaps, moves


class TestCoachSessionBest:
    def test_the_player_is_held_against_a_quicker_rival(self):
        coach = Coach()
        coach.set_track("spa", LENGTH)
        clean = mt.drive_lap()
        slow = mt.drive_lap({2: mt.Mistake(apex_slow_kmh=10)})
        snaps, moves = drive_session(coach, [slow] * 4, {5: [clean] * 4})
        assert moves >= 1
        last = snaps[-1]
        assert last["sessionBest"]["carIdx"] == 5
        assert last["sessionBest"]["isPlayer"] is False
        vs = last["vsBest"]
        assert vs["carIdx"] == 5
        assert vs["delta"] == pytest.approx(slow.lap_time - clean.lap_time, abs=0.01)
        assert sum(c["timeLost"] for c in vs["corners"]) == pytest.approx(vs["delta"], abs=0.01)
        worst = max(vs["corners"], key=lambda c: c["timeLost"])
        assert worst["corner"] == 3
        # The coach's own analysis is still against the player's own laps.
        assert last["lastLap"]["delta"] == pytest.approx(0.0, abs=0.01)

    def test_a_quicker_player_lap_becomes_the_session_best_after_its_comparison(self):
        coach = Coach()
        coach.set_track("spa", LENGTH)
        clean = mt.drive_lap()
        slow = mt.drive_lap({2: mt.Mistake(apex_slow_kmh=10)})
        middling = mt.drive_lap({2: mt.Mistake(apex_slow_kmh=4)})
        snaps, _ = drive_session(coach, [slow, slow, clean, clean], {5: [middling] * 5})
        # The rival's first timed lap lands before the player's first.
        first, second = snaps[0], snaps[1]
        assert first["vsBest"]["carIdx"] == 5 and first["vsBest"]["delta"] > 0
        assert first["sessionBest"]["carIdx"] == 5
        # The clean lap beats it: compared against the rival, then kept.
        assert second["vsBest"]["carIdx"] == 5
        assert second["vsBest"]["delta"] < 0
        assert second["sessionBest"] == {
            "carIdx": 0,
            "lap": second["lastLap"]["lap"],
            "lapTime": second["lastLap"]["lapTime"],
            "isPlayer": True,
        }
        # And the lap after it is measured against the player's own best.
        assert snaps[2]["vsBest"]["isPlayer"] is True
        assert snaps[2]["vsBest"]["delta"] == pytest.approx(0.0, abs=0.01)

    def test_snapshot_carries_the_live_session_best(self):
        coach = Coach()
        coach.set_track("spa", LENGTH)
        assert coach.snapshot().session_best is None
        clean = mt.drive_lap()
        moves = 0
        for t, arrays in field_frames({5: [clean] * 4}, total([clean] * 3) + 0.2):
            moves += coach.feed_field(t, arrays, [0, 5], 0)
        assert moves == 1  # the same lap time twice is not a new best
        best = coach.snapshot().to_dict()["sessionBest"]
        assert best["carIdx"] == 5
        assert best["lapTime"] == pytest.approx(clean.lap_time, abs=0.002)
        assert coach.snapshot().to_dict()["vsBest"] is None

    def test_a_new_track_forgets_the_session_best(self):
        coach = Coach()
        coach.set_track("spa", LENGTH)
        clean = mt.drive_lap()
        for t, arrays in field_frames({5: [clean] * 4}, total([clean] * 3) + 0.2):
            coach.feed_field(t, arrays, [5], 0)
        assert coach.snapshot().session_best is not None
        coach.set_track("monza", 5793.0)
        assert coach.snapshot().session_best is None


# ---------------------------------------------------------------------------
# Service wiring
# ---------------------------------------------------------------------------


class TestClassRivals:
    def test_same_class_racing_cars_only(self):
        raw = make_session_raw(
            drivers=[
                make_driver(0, car_class_id=1),
                make_driver(1, car_class_id=1),
                make_driver(2, car_class_id=2),
                make_driver(3, car_class_id=1, is_pace_car=True),
                make_driver(4, car_class_id=1, is_spectator=True),
            ]
        )
        service = BridgeService(None)  # type: ignore[arg-type]
        service._session_repo.update(raw)
        rivals = class_rivals(0, service._session_repo.drivers_by_idx)
        assert sorted(rivals) == [0, 1]

    def test_unknown_player_compares_with_everybody_racing(self):
        assert class_rivals(9, {}) == []


class TestServiceSessionBest:
    def test_a_rival_setting_a_session_best_is_published(self):
        service = BridgeService(None)  # type: ignore[arg-type]
        published: list[tuple[str, Any]] = []

        class Pub:
            async def publish(self, channel, payload):
                published.append((channel, payload))

        service._publisher = Pub()  # type: ignore[assignment]
        service._session_repo.update(make_session_raw(drivers=[make_driver(0), make_driver(5)]))
        clean = mt.drive_lap()

        async def drive():
            for t, arrays in field_frames({5: [clean] * 4}, total([clean] * 3) + 0.2):
                await service._coach_frame({"sessionTime": t, "lapDistPct": 0.0}, arrays)

        asyncio.run(drive())
        bests = [
            p["sessionBest"] for c, p in published if c == Channel.COACHING and p["sessionBest"]
        ]
        assert bests and bests[-1]["carIdx"] == 5

    def test_the_arrays_own_clock_wins_over_the_frames(self):
        service = BridgeService(None)  # type: ignore[arg-type]
        published: list[tuple[str, Any]] = []

        class Pub:
            async def publish(self, channel, payload):
                published.append((channel, payload))

        service._publisher = Pub()  # type: ignore[assignment]
        service._session_repo.update(make_session_raw(drivers=[make_driver(0), make_driver(5)]))
        clean = mt.drive_lap()

        async def drive():
            for t, arrays in field_frames({5: [clean] * 4}, total([clean] * 3) + 0.2):
                # A frame whose clock never moves: only the arrays' tick can
                # time the rival's laps.
                await service._coach_frame({"sessionTime": 0.0}, {**arrays, "SessionTime": t})

        asyncio.run(drive())
        assert service._coach.snapshot().session_best["carIdx"] == 5
