"""The coach, tested against laps whose mistakes are known.

Every lap here comes from :mod:`telemetrylab.mocktrack`, sampled at 60 Hz on
the session clock exactly as the bridge reads the sim. The central claims:

- the per-corner losses add up to the lap-time difference, always;
- each kind of injected mistake is found in the corner it was made in, with
  the right cause and roughly the right size;
- laps that should not count (pit lane, resets, off-tracks) are handled as
  the overlay promises.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

import pytest

from telemetrylab import mocktrack as mt
from telemetrylab.coaching import Coach, CornerAnalysis, LapRecorder, classify, resample
from telemetrylab.coaching.compare import (
    CAUSES,
    compare_lap,
    segment_loss,
    time_delta,
)
from telemetrylab.coaching.corners import Ring, detect_corners, ring_for
from telemetrylab.coaching.laps import (
    RecordedLap,
    Sample,
    grid_points,
    sample_from_frame,
)
from telemetrylab.coaching.traffic import traffic_near
from telemetrylab.models import CarTiming

from .conftest import lap_frames

LENGTH = mt.TRACK_LENGTH_M


def record(laps: list[mt.MockLap], **kw: Any) -> list[RecordedLap]:
    """Run frames for ``laps`` through a recorder; return the laps it cut."""
    rec = LapRecorder()
    out = []
    for f in lap_frames(laps, **kw):
        lap = rec.add(f)
        if lap is not None:
            out.append(lap)
    return out


def feed(coach: Coach, frames: Iterator[dict[str, Any]], traffic: Any = None) -> list[dict]:
    snaps = []
    for f in frames:
        busy = bool(traffic(f)) if traffic else False
        snap = coach.feed(f, busy)
        if snap is not None:
            snaps.append(snap.to_dict())
    return snaps


def by_corner(snap: dict) -> dict[int, dict]:
    return {a["corner"]: a for a in snap["analysis"]}


# One lap with five different mistakes, in five different corners, compared
# against a clean reference — the expensive fixture most tests share.
MISTAKES = {
    0: mt.Mistake(brake_early_m=15),
    1: mt.Mistake(coast_m=120),
    2: mt.Mistake(apex_slow_kmh=8),
    3: mt.Mistake(brake_late_m=12, apex_slow_kmh=6),
    4: mt.Mistake(throttle_late_m=30),
}


@pytest.fixture(scope="module")
def mistake_run() -> list[dict]:
    coach = Coach()
    coach.set_track("spa", LENGTH)
    clean = mt.drive_lap()
    laps = [clean, clean, mt.drive_lap(MISTAKES), clean]
    return feed(coach, lap_frames(laps))


# ---------------------------------------------------------------------------
# Recorder
# ---------------------------------------------------------------------------


class TestLapRecorder:
    def test_cuts_whole_laps_only_and_times_them_to_the_frame(self):
        laps = [mt.drive_lap(), mt.drive_lap({1: mt.Mistake(coast_m=100)}), mt.drive_lap()]
        cut = record(laps, start_lap=4)
        # Lap 4 starts at the very first frame — but the recorder never saw
        # its line crossing, so it is not timed. Laps 5 and 6 are.
        assert [c.lap for c in cut] == [5, 6]
        for c, src in zip(cut, laps[1:], strict=True):
            assert c.lap_time == pytest.approx(src.lap_time, abs=1 / 60)
            assert c.clean
            assert c.samples[0].pct == 0.0 and c.samples[-1].pct == 1.0

    def test_joining_mid_lap_skips_the_partial_lap(self):
        rec = LapRecorder()
        lap = mt.drive_lap()
        frames = list(lap_frames([lap, lap]))
        half = len(frames) // 4
        # Joined a quarter of the way into lap 0: only lap 1 is ever timed.
        assert [x.lap for f in frames[half:] if (x := rec.add(f))] == [1]

    def test_repeated_frames_are_ignored(self):
        rec = LapRecorder()
        frame = {"sessionTime": 10.0, "lapDistPct": 0.5, "speedKmh": 100.0}
        assert rec.add(frame) is None
        assert rec.add(dict(frame)) is None
        assert rec._prev is not None and rec._prev.t == 10.0

    def test_clock_running_backwards_starts_over(self):
        rec = LapRecorder()
        rec.add({"sessionTime": 100.0, "lapDistPct": 0.95})
        rec.add({"sessionTime": 101.0, "lapDistPct": 0.02})  # a line crossing
        assert rec._lap is not None
        rec.add({"sessionTime": 5.0, "lapDistPct": 0.3})  # new session
        assert rec._lap is None

    def test_frames_without_time_or_position_are_skipped(self):
        assert sample_from_frame({"lapDistPct": 0.5}) is None
        assert sample_from_frame({"sessionTime": 1.0}) is None
        s = sample_from_frame({"sessionTime": 1.0, "lapDistPct": 0.5, "speed": 50.0})
        assert s is not None and s.speed == pytest.approx(180.0)

    @pytest.mark.parametrize(
        ("override", "reason"),
        [
            ({"onPitRoad": True}, "pit"),
            ({"trackSurface": 2}, "pit"),
            ({"trackSurface": 0}, "off_track"),
            ({"trackSurface": -1}, "reset"),
            ({"incidentCount": 2}, "incident"),
        ],
    )
    def test_flags(self, override, reason):
        def hit(k, pct):
            return override if k == 2 and 0.5 < pct < 0.51 else None

        lap = mt.drive_lap()
        cut = record([lap, lap, lap], overrides=hit)
        assert cut[0].clean
        assert cut[1].invalid_reason == reason

    def test_most_serious_reason_wins(self):
        def hit(k, pct):
            if k != 2:
                return None
            if 0.3 < pct < 0.31:
                return {"trackSurface": 0}
            if 0.6 < pct < 0.61:
                return {"onPitRoad": True}
            return None

        lap = mt.drive_lap()
        cut = record([lap, lap, lap], overrides=hit)
        assert cut[1].invalid_reason == "pit"
        assert not cut[1].comparable

    def test_teleport_is_a_reset(self):
        def jump(k, pct):
            return {"lapDistPct": min(0.99, pct + 0.3)} if k == 2 and 0.4 < pct < 0.41 else None

        lap = mt.drive_lap()
        cut = record([lap, lap, lap], overrides=jump)
        assert cut[1].invalid_reason == "reset"

    def test_a_hole_in_the_lap_is_incomplete(self):
        rec = LapRecorder()
        lap = mt.drive_lap()
        out = []
        for f in lap_frames([lap, lap, lap]):
            if f["lap"] == 2 and 0.4 < f["lapDistPct"] < 0.45:
                continue  # frames lost
            if (x := rec.add(f)) is not None:
                out.append(x)
        assert out[1].invalid_reason == "incomplete"

    def test_lap_numbers_fall_back_to_counting(self):
        rec = LapRecorder()
        lap = mt.drive_lap()
        out = []
        for f in lap_frames([lap, lap, lap]):
            f.pop("lap")
            if (x := rec.add(f)) is not None:
                out.append(x.lap)
        assert out == [0, 1]


# ---------------------------------------------------------------------------
# Resampling
# ---------------------------------------------------------------------------


class TestResample:
    def test_grid_points(self):
        assert grid_points(7004) == 3503
        assert grid_points(None) == 2001
        assert grid_points(100) == 201
        assert grid_points(50_000) == 5001

    def test_endpoints_are_the_line_and_time_increases(self):
        lap = record([mt.drive_lap()] * 2)[0]
        r = resample(lap, 1001)
        assert r.n == 1001
        assert r.t[0] == 0.0 and r.t[-1] == lap.lap_time
        assert all(b > a for a, b in zip(r.t, r.t[1:], strict=False))

    def test_needs_two_distinct_points(self):
        lap = RecordedLap(lap=1, lap_time=1.0, samples=[Sample(0, 0.5, 1, 1, 0, 1)] * 3)
        with pytest.raises(ValueError):
            resample(lap, 10)


# ---------------------------------------------------------------------------
# Corners
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def reference():
    lap = record([mt.drive_lap()] * 2)[0]
    return resample(lap, grid_points(LENGTH))


class TestCorners:
    def test_finds_the_six_corners_where_they_are(self, reference):
        corners = detect_corners(reference, LENGTH)
        assert [c.label for c in corners] == [f"T{i}" for i in range(1, 7)]
        last = reference.n - 1
        for c, mc in zip(corners, mt.CORNERS, strict=True):
            assert c.apex / last == pytest.approx(mc.apex_pct, abs=0.002)

    def test_entry_is_the_braking_point_and_segments_lead_it(self, reference):
        ring = ring_for(reference, LENGTH)
        for c in detect_corners(reference, LENGTH):
            # Braking starts at the entry, never before it …
            assert reference.brake[c.entry] > 0.1 or reference.throttle[c.entry] < 0.95
            assert reference.throttle[ring.wrap(c.entry - 1)] >= 0.95
            # … and each segment opens a margin ahead of it.
            assert 0 < ring.ahead(c.start, c.entry) * ring.step_m <= 80.0 + ring.step_m
            assert ring.ahead(c.entry, c.apex) < ring.ahead(c.entry, c.exit)

    def test_la_source_straddles_the_line(self, reference):
        t1 = detect_corners(reference, LENGTH)[0]
        assert t1.start > t1.apex  # its segment opens before the line

    def test_a_constant_speed_lap_has_no_corners(self, reference):
        flat = resample(record([mt.drive_lap()] * 2)[0], 501)
        flat.speed = [200.0] * flat.n
        assert detect_corners(flat, LENGTH) == []

    def test_close_minima_merge_into_one_corner(self):
        corners = (mt.MockCorner(0.30, 80.0, "a"), mt.MockCorner(0.305, 70.0, "b"))
        lap = mt.drive_lap(corners=corners)
        rec = record([lap, lap])
        r = resample(rec[0], grid_points(LENGTH))
        found = detect_corners(r, LENGTH)
        assert len(found) == 1
        assert found[0].apex / (r.n - 1) == pytest.approx(0.305, abs=0.002)

    def test_a_single_corner_track(self):
        lap = mt.drive_lap(corners=(mt.MockCorner(0.5, 90.0, "only"),))
        r = resample(record([lap, lap])[0], grid_points(LENGTH))
        (only,) = detect_corners(r, LENGTH)
        assert only.label == "T1"
        ring = ring_for(r, LENGTH)
        delta = time_delta(r, r)
        assert segment_loss(delta, only.start, only.start, ring) == 0.0

    def test_unknown_length_still_works(self, reference):
        assert len(detect_corners(reference, None)) == 6


# ---------------------------------------------------------------------------
# Comparison
# ---------------------------------------------------------------------------


class TestCompare:
    def test_losses_add_up_to_the_lap_delta(self, mistake_run):
        snap = mistake_run[1]
        total = sum(a["timeLost"] for a in snap["analysis"])
        assert total == pytest.approx(snap["lastLap"]["delta"], abs=0.005)
        assert snap["lastLap"]["delta"] > 1.0

    @pytest.mark.parametrize(
        ("corner", "cause", "field", "expected", "tol"),
        [
            (1, "early_brake", "brakeDeltaM", 15.0, 3.0),
            (2, "coasting", "coastDeltaM", 120.0, 20.0),
            (3, "over_slowed", "minSpeedDeltaKmh", -8.0, 0.6),
            (4, "overdrove", "brakeDeltaM", -12.0, 5.0),
            (5, "late_throttle", "throttleDeltaM", 30.0, 3.0),
        ],
    )
    def test_each_injected_mistake_is_found(self, mistake_run, corner, cause, field, expected, tol):
        a = by_corner(mistake_run[1])[corner]
        assert a["cause"] == cause
        assert a["timeLost"] > 0.05
        assert a[field] == pytest.approx(expected, abs=tol)

    def test_the_clean_corner_is_even(self, mistake_run):
        assert by_corner(mistake_run[1])[6]["cause"] == "even"

    def test_a_clean_lap_against_itself_is_even_everywhere(self, reference):
        ring = ring_for(reference, LENGTH)
        corners = detect_corners(reference, LENGTH)
        for a in compare_lap(reference, reference, corners, ring):
            assert a.time_lost == 0.0 and a.cause == "even"

    def test_laps_must_share_a_grid(self, reference):
        other = resample(record([mt.drive_lap()] * 2)[0], 501)
        with pytest.raises(ValueError):
            compare_lap(other, reference, [], ring_for(reference, LENGTH))

    def test_segment_loss_across_the_line(self):
        ring = Ring(m=10, step_m=1.0)
        delta = [0.0, 0.1, 0.1, 0.2, 0.2, 0.3, 0.3, 0.3, 0.4, 0.5, 0.6]
        # [8, 10) ∪ [0, 2): 0.6 - 0.4 + 0.1 - 0.0
        assert segment_loss(delta, 8, 2, ring) == pytest.approx(0.3)
        assert segment_loss(delta, 2, 8, ring) == pytest.approx(0.3)


def _analysis(**kw: Any) -> CornerAnalysis:
    base: dict[str, Any] = {
        "corner": 1,
        "time_lost": 0.2,
        "cause": "",
        "brake_delta_m": 0.0,
        "entry_speed_delta_kmh": 0.0,
        "min_speed_delta_kmh": 0.0,
        "exit_speed_delta_kmh": 0.0,
        "throttle_delta_m": 0.0,
        "coast_delta_m": 0.0,
        "traffic": False,
    }
    base.update(kw)
    return CornerAnalysis(**base)


class TestClassify:
    @pytest.mark.parametrize(
        ("kw", "cause"),
        [
            ({"time_lost": -0.1}, "gain"),
            ({"time_lost": 0.01}, "even"),
            ({"traffic": True, "brake_delta_m": 20.0}, "traffic"),
            ({"brake_delta_m": 9.0, "min_speed_delta_kmh": -5.0}, "early_brake"),
            ({"coast_delta_m": 30.0}, "coasting"),
            ({"entry_speed_delta_kmh": 4.0, "min_speed_delta_kmh": -4.0}, "overdrove"),
            ({"brake_delta_m": -8.0, "min_speed_delta_kmh": -4.0}, "overdrove"),
            ({"min_speed_delta_kmh": -4.0}, "over_slowed"),
            ({"throttle_delta_m": 12.0}, "late_throttle"),
            ({"exit_speed_delta_kmh": -4.0}, "slow_exit"),
            ({}, "line"),
            ({"brake_delta_m": None, "throttle_delta_m": None}, "line"),
        ],
    )
    def test_rules(self, kw, cause):
        assert classify(_analysis(**kw)) == cause
        assert cause in CAUSES

    def test_to_dict_rounds_and_keeps_nulls(self):
        d = _analysis(time_lost=0.12345, brake_delta_m=None, cause="line").to_dict()
        assert d["timeLost"] == 0.123
        assert d["brakeDeltaM"] is None
        assert set(d) >= {"corner", "cause", "traffic", "repeat", "repeatWindow"}


# ---------------------------------------------------------------------------
# The coach
# ---------------------------------------------------------------------------


class TestCoach:
    def test_waits_for_a_clean_lap(self):
        coach = Coach()
        coach.set_track("spa", LENGTH)
        snap = coach.snapshot().to_dict()
        assert snap["state"] == "waiting"
        assert snap["reference"] is None and snap["lastLap"] is None
        assert snap["trackLengthM"] == LENGTH

    def test_first_clean_lap_becomes_the_reference(self, mistake_run):
        first = mistake_run[0]
        assert first["state"] == "analysed" and first["newReference"]
        assert first["reference"] == {"lap": 1, "lapTime": first["lastLap"]["lapTime"]}
        assert first["analysis"] == []
        assert len(first["corners"]) == 6
        assert first["corners"][0]["label"] == "T1"

    def test_a_slower_lap_keeps_the_reference(self, mistake_run):
        second = mistake_run[1]
        assert not second["newReference"]
        assert second["reference"]["lap"] == 1
        assert second["lapsAnalysed"] == 1

    def test_an_unclean_first_lap_does_not_become_the_reference(self):
        coach = Coach()
        coach.set_track("spa", LENGTH)
        lap = mt.drive_lap()

        def off(k, pct):
            return {"trackSurface": 0} if k == 1 and 0.5 < pct < 0.51 else None

        snaps = feed(coach, lap_frames([lap, lap, lap], overrides=off))
        assert snaps[0]["state"] == "waiting"
        assert snaps[0]["lastLap"]["invalidReason"] == "off_track"
        assert snaps[1]["newReference"]

    def test_a_pit_lap_is_skipped(self):
        coach = Coach()
        coach.set_track("spa", LENGTH)
        lap = mt.drive_lap()

        def pit(k, pct):
            return {"onPitRoad": True} if k == 2 and pct > 0.9 else None

        snaps = feed(coach, lap_frames([lap, lap, lap, lap], overrides=pit))
        assert snaps[1]["state"] == "skipped"
        assert snaps[1]["analysis"] == []
        assert snaps[1]["reference"]["lap"] == 1

    def test_a_quicker_off_track_lap_is_compared_but_not_kept(self):
        coach = Coach()
        coach.set_track("spa", LENGTH)
        slow = mt.drive_lap({2: mt.Mistake(apex_slow_kmh=10)})
        fast = mt.drive_lap()

        def off(k, pct):
            return {"trackSurface": 0} if k == 2 and 0.6 < pct < 0.61 else None

        snaps = feed(coach, lap_frames([slow, slow, fast, slow], overrides=off))
        assert snaps[1]["lastLap"]["valid"] is False
        assert snaps[1]["lastLap"]["delta"] < 0
        assert not snaps[1]["newReference"]
        assert snaps[1]["reference"]["lap"] == 1

    def test_a_new_best_is_compared_then_kept(self):
        coach = Coach()
        coach.set_track("spa", LENGTH)
        slow = mt.drive_lap({2: mt.Mistake(apex_slow_kmh=10)})
        fast = mt.drive_lap()
        snaps = feed(coach, lap_frames([slow, slow, fast, slow]))
        best = snaps[1]
        assert best["newReference"]
        assert best["reference"]["lap"] == 2
        assert by_corner(best)[3]["cause"] == "gain"
        # And the next lap is measured against it.
        assert snaps[2]["reference"]["lap"] == 2
        assert by_corner(snaps[2])[3]["cause"] == "over_slowed"

    def test_repeats_are_tallied(self):
        coach = Coach()
        coach.set_track("spa", LENGTH)
        clean = mt.drive_lap()
        early = mt.drive_lap({2: mt.Mistake(brake_early_m=20)})
        snaps = feed(coach, lap_frames([clean, clean, early, clean, early, early]))
        last = by_corner(snaps[-1])[3]
        assert last["cause"] == "early_brake"
        # Compared laps at T3: early, even, early, early.
        assert (last["repeat"], last["repeatWindow"]) == (3, 4)
        assert by_corner(snaps[-1])[1]["repeat"] == 0  # "even" is never tallied

    def test_traffic_is_not_blamed_on_the_driver(self):
        coach = Coach()
        coach.set_track("spa", LENGTH)
        clean = mt.drive_lap()
        early = mt.drive_lap({2: mt.Mistake(brake_early_m=20)})

        def busy(f):
            return f["lap"] == 2 and 0.37 < f["lapDistPct"] < 0.40

        snaps = feed(coach, lap_frames([clean, clean, early, clean]), traffic=busy)
        assert by_corner(snaps[1])[3]["cause"] == "traffic"
        assert by_corner(snaps[1])[3]["traffic"] is True

    def test_set_track(self):
        coach = Coach()
        assert coach.set_track("a", LENGTH)
        assert not coach.set_track("a", LENGTH)
        assert coach.track_key == "a"
        assert coach.set_track("b", None)
        assert coach.snapshot().track_length_m is None
        coach.reset()
        assert coach.track_key is None

    def test_a_new_track_starts_over(self, mistake_run):
        coach = Coach()
        coach.set_track("spa", LENGTH)
        feed(coach, lap_frames([mt.drive_lap()] * 3))
        assert coach.snapshot().reference is not None
        coach.set_track("monza", 5793.0)
        assert coach.snapshot().state == "waiting"
        assert coach.snapshot().reference is None


# ---------------------------------------------------------------------------
# Traffic
# ---------------------------------------------------------------------------


def _car(idx: int, pct: float | None, *, pit: bool = False, surface: int = 3) -> CarTiming:
    return CarTiming(
        car_idx=idx,
        position=None,
        class_position=None,
        lap=1,
        lap_dist_pct=pct,
        last_lap_time=None,
        best_lap_time=None,
        estimated_lap_time=None,
        f2_time=None,
        delta_to_player=None,
        on_pit_road=pit,
        track_surface=surface,
        track_surface_label="on_track",
        timestamp=0,
    )


class TestTraffic:
    @pytest.mark.parametrize(
        ("other", "busy"),
        [
            (0.5 + 30 / 7000, True),  # 30 m ahead
            (0.5 + 60 / 7000, False),  # 60 m ahead
            (0.5 - 5 / 7000, True),  # alongside
            (0.5 - 20 / 7000, False),  # behind
        ],
    )
    def test_window(self, other, busy):
        timings = {0: _car(0, 0.5), 1: _car(1, other)}
        assert traffic_near(0, timings, 7000.0) is busy

    def test_across_the_line(self):
        timings = {0: _car(0, 0.998), 1: _car(1, 0.002)}  # 28 m ahead
        assert traffic_near(0, timings, 7000.0)

    def test_ignores_cars_in_the_pits_or_off_track_and_missing_data(self):
        near = 0.5 + 10 / 7000
        assert not traffic_near(0, {0: _car(0, 0.5), 1: _car(1, near, pit=True)}, 7000.0)
        assert not traffic_near(0, {0: _car(0, 0.5), 1: _car(1, near, surface=0)}, 7000.0)
        assert not traffic_near(0, {0: _car(0, 0.5), 1: _car(1, None)}, 7000.0)
        assert not traffic_near(0, {0: _car(0, None), 1: _car(1, near)}, 7000.0)
        assert not traffic_near(0, {0: _car(0, 0.5), 1: _car(1, near)}, None)
        assert not traffic_near(0, {}, 7000.0)
