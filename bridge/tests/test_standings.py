"""Tests for the stateful standings engine."""

from __future__ import annotations

from telemetrylab.enums import CAR_FLAG_DISQUALIFY, CAR_FLAG_REPAIR
from telemetrylab.models import CarTiming
from telemetrylab.parsing import parse_session_info
from telemetrylab.standings import (
    RECENT_LAPS,
    StandingsEngine,
    _projected_irating_changes,
    _sort_key,
)

from .conftest import make_driver, make_session_raw


def _timing(
    car_idx,
    *,
    position,
    lap=10,
    pct=0.5,
    f2=0.0,
    last=92.0,
    best=91.0,
    surface=3,
    pit=False,
    tire=0,
    flags=None,
):
    return CarTiming(
        car_idx=car_idx,
        position=position,
        class_position=position,
        lap=lap,
        lap_dist_pct=pct,
        last_lap_time=last,
        best_lap_time=best,
        estimated_lap_time=None,
        f2_time=f2,
        delta_to_player=None,
        on_pit_road=pit,
        track_surface=surface,
        track_surface_label={3: "on_track", 1: "in_pit_stall", 0: "off_track", -1: "not_in_world"}[
            surface
        ],
        timestamp=0,
        tire_compound=tire,
        session_flags=flags,
    )


def _session(drivers=None, **kw):
    drivers = (
        drivers
        if drivers is not None
        else [
            make_driver(0, car_class_id=1),
            make_driver(1, car_class_id=1),
            make_driver(2, car_class_id=1),
        ]
    )
    raw = make_session_raw(drivers=drivers, **kw)
    # Race + racing state so the engine captures a start grid.
    raw["session_state"] = 4
    return parse_session_info(raw)


def _drivers_by_idx(session):
    return {d.car_idx: d for d in session.drivers}


class TestSortKey:
    def test_by_position(self):
        a = _timing(0, position=1)
        b = _timing(1, position=2)
        assert _sort_key(a) < _sort_key(b)

    def test_no_position_sorts_last(self):
        a = _timing(0, position=None, lap=5, pct=0.9)
        b = _timing(1, position=5)
        assert _sort_key(b) < _sort_key(a)


class TestProjectedIRating:
    def test_fewer_than_two_is_zero(self):
        assert _projected_irating_changes([(0, 2000, 1)]) == {0: 0}

    def test_symmetric_zero_sum_ish(self):
        # Two equal-rated cars; leader gains, trailer loses, mirror-image.
        out = _projected_irating_changes([(0, 2000, 1), (1, 2000, 2)])
        assert out[0] == -out[1]
        assert out[0] > 0  # P1 running ahead of a coin-flip expectation

    def test_ignores_zero_rating_or_position(self):
        out = _projected_irating_changes([(0, 0, 1), (1, 2000, 2), (2, 2000, 3)])
        assert 0 not in out


class TestStandingsEngine:
    def test_orders_by_position(self):
        session = _session()
        timings = {
            0: _timing(0, position=3),
            1: _timing(1, position=1),
            2: _timing(2, position=2),
        }
        snap = StandingsEngine().compute(session, _drivers_by_idx(session), timings, 1000)
        assert [e.car_idx for e in snap.entries] == [1, 2, 0]

    def test_leader_has_zero_gap(self):
        session = _session()
        timings = {0: _timing(0, position=1, f2=0.0), 1: _timing(1, position=2, f2=1.5)}
        snap = StandingsEngine().compute(session, _drivers_by_idx(session), timings, 0)
        leader = snap.entries[0]
        assert leader.gap_to_leader == 0.0
        assert leader.is_overall_leader is True

    def test_gap_and_interval_from_f2(self):
        session = _session()
        timings = {
            0: _timing(0, position=1, f2=0.0),
            1: _timing(1, position=2, f2=1.5),
            2: _timing(2, position=3, f2=4.0),
        }
        snap = StandingsEngine().compute(session, _drivers_by_idx(session), timings, 0)
        assert snap.entries[1].gap_to_leader == 1.5
        assert snap.entries[2].gap_to_leader == 4.0
        # interval is gap minus previous car's gap.
        assert snap.entries[2].interval == 2.5

    def test_lapped_car_gap_is_laps(self):
        session = _session()
        timings = {
            0: _timing(0, position=1, lap=15),
            1: _timing(1, position=2, lap=13),  # two laps down
        }
        snap = StandingsEngine().compute(session, _drivers_by_idx(session), timings, 0)
        e = snap.entries[1]
        assert e.gap_is_laps is True
        assert e.laps_down == 2
        assert e.gap_to_leader == 2.0
        assert e.interval is None

    def test_pace_and_spectator_excluded(self):
        drivers = [
            make_driver(0, car_class_id=1),
            make_driver(1, car_class_id=1, is_pace_car=True),
            make_driver(2, car_class_id=1, is_spectator=True),
        ]
        session = _session(drivers=drivers)
        timings = {i: _timing(i, position=i + 1) for i in range(3)}
        snap = StandingsEngine().compute(session, _drivers_by_idx(session), timings, 0)
        assert [e.car_idx for e in snap.entries] == [0]

    def test_player_flagged(self):
        session = _session()
        # driver_car_idx defaults to 0.
        timings = {0: _timing(0, position=1), 1: _timing(1, position=2)}
        snap = StandingsEngine().compute(session, _drivers_by_idx(session), timings, 0)
        assert snap.entries[0].is_player is True
        assert snap.entries[1].is_player is False

    def test_position_gain_since_start(self):
        session = _session()
        engine = StandingsEngine()
        dbi = _drivers_by_idx(session)
        # First tick: car 2 starts P3.
        engine.compute(
            session,
            dbi,
            {2: _timing(2, position=3), 0: _timing(0, position=1), 1: _timing(1, position=2)},
            0,
        )
        # Later: car 2 has climbed to P1.
        snap = engine.compute(
            session,
            dbi,
            {2: _timing(2, position=1), 0: _timing(0, position=2), 1: _timing(1, position=3)},
            1000,
        )
        car2 = next(e for e in snap.entries if e.car_idx == 2)
        assert car2.positions_gained_total == 2  # from P3 to P1

    def test_retirement_after_sustained_absence(self):
        session = _session()
        engine = StandingsEngine()
        dbi = _drivers_by_idx(session)
        # Seen in-world once.
        engine.compute(session, dbi, {0: _timing(0, position=1, surface=3)}, 0)
        # Then not-in-world for many ticks.
        snap = None
        for tick in range(1, 40):
            snap = engine.compute(session, dbi, {0: _timing(0, position=1, surface=-1)}, tick * 100)
        assert snap.entries[0].is_retired is True

    def test_class_grouping_and_leaders(self):
        drivers = [
            make_driver(0, car_class_id=1, car_class_short_name="GT3", i_rating=3000),
            make_driver(1, car_class_id=2, car_class_short_name="GT4", i_rating=1500),
            make_driver(2, car_class_id=1, car_class_short_name="GT3", i_rating=3000),
        ]
        session = _session(drivers=drivers)
        timings = {
            0: _timing(0, position=1),
            1: _timing(1, position=2),
            2: _timing(2, position=3),
        }
        snap = StandingsEngine().compute(session, _drivers_by_idx(session), timings, 0)
        # Two classes present.
        assert len(snap.classes) == 2
        # First car of class 1 in overall order is its class leader.
        gt3_leader = next(e for e in snap.entries if e.car_class_id == 1)
        assert gt3_leader.is_class_leader is True

    def test_snapshot_serializes(self):
        session = _session()
        timings = {0: _timing(0, position=1), 1: _timing(1, position=2)}
        snap = StandingsEngine().compute(session, _drivers_by_idx(session), timings, 0)
        wire = snap.to_dict()
        assert wire["playerCarIdx"] == 0
        assert isinstance(wire["entries"], list)
        assert wire["entries"][0]["carIdx"] == 0

    def test_empty_field(self):
        session = _session(drivers=[make_driver(0, is_pace_car=True)])
        snap = StandingsEngine().compute(session, _drivers_by_idx(session), {}, 0)
        assert snap.entries == []


def _entry(snap, car_idx):
    return next(e for e in snap.entries if e.car_idx == car_idx)


class TestRecentLaps:
    def test_records_each_new_lap_once(self):
        session = _session()
        engine = StandingsEngine()
        dbi = _drivers_by_idx(session)
        snap = None
        # The same last-lap value on several ticks is one lap, not several.
        for tick, last in enumerate([92.0, 92.0, 92.0, 91.5, 91.5, 93.25]):
            snap = engine.compute(session, dbi, {0: _timing(0, position=1, last=last)}, tick)
        assert _entry(snap, 0).recent_laps == [92.0, 91.5, 93.25]

    def test_keeps_only_the_latest_laps_oldest_first(self):
        session = _session()
        engine = StandingsEngine()
        dbi = _drivers_by_idx(session)
        snap = None
        laps = [90.0 + i for i in range(RECENT_LAPS + 3)]
        for tick, last in enumerate(laps):
            snap = engine.compute(session, dbi, {0: _timing(0, position=1, last=last)}, tick)
        assert _entry(snap, 0).recent_laps == laps[-RECENT_LAPS:]

    def test_no_valid_time_records_nothing(self):
        session = _session()
        snap = StandingsEngine().compute(
            session, _drivers_by_idx(session), {0: _timing(0, position=1, last=None)}, 0
        )
        assert _entry(snap, 0).recent_laps == []

    def test_new_session_starts_a_fresh_trend(self):
        engine = StandingsEngine()
        first = _session()
        engine.compute(first, _drivers_by_idx(first), {0: _timing(0, position=1, last=92.0)}, 0)
        second = _session(session_num=1, sessions=[{}, {"SessionType": "Race"}])
        snap = engine.compute(
            second, _drivers_by_idx(second), {0: _timing(0, position=1, last=95.0)}, 1
        )
        assert _entry(snap, 0).recent_laps == [95.0]

    def test_on_the_wire(self):
        session = _session()
        snap = StandingsEngine().compute(
            session, _drivers_by_idx(session), {0: _timing(0, position=1, last=92.0)}, 0
        )
        assert snap.to_dict()["entries"][0]["recentLaps"] == [92.0]


class TestCarFlags:
    def test_disqualified_and_meatball_from_the_per_car_mask(self):
        session = _session()
        timings = {
            0: _timing(0, position=1, flags=0),
            1: _timing(1, position=2, flags=CAR_FLAG_DISQUALIFY),
            2: _timing(2, position=3, flags=CAR_FLAG_REPAIR),
        }
        snap = StandingsEngine().compute(session, _drivers_by_idx(session), timings, 0)
        assert (_entry(snap, 0).is_disqualified, _entry(snap, 0).needs_repair) == (False, False)
        assert _entry(snap, 1).is_disqualified is True
        assert _entry(snap, 2).needs_repair is True

    def test_missing_mask_means_no_flags(self):
        session = _session()
        snap = StandingsEngine().compute(
            session, _drivers_by_idx(session), {0: _timing(0, position=1, flags=None)}, 0
        )
        wire = snap.to_dict()["entries"][0]
        assert wire["isDisqualified"] is False
        assert wire["needsRepair"] is False


class TestRaceEnd:
    """The final lap and the finish are derived from SessionFlags + lap counts."""

    def _tick(self, engine, *, flags, state, laps):
        session = _session(session_flags=flags)
        session.session_state = state
        timings = {
            idx: _timing(idx, position=pos, lap=lap) for pos, (idx, lap) in enumerate(laps, 1)
        }
        return engine.compute(session, _drivers_by_idx(session), timings, 0)

    def test_nothing_before_the_white(self):
        snap = self._tick(StandingsEngine(), flags=0x4, state=4, laps=[(0, 20), (1, 20)])
        assert not any(e.on_final_lap or e.has_finished for e in snap.entries)

    def test_the_leader_is_on_its_final_lap_the_moment_the_white_shows(self):
        engine = StandingsEngine()
        # The leader's counter has already ticked to 21 on the white frame.
        snap = self._tick(engine, flags=0x2, state=4, laps=[(0, 21), (1, 20), (2, 19)])
        assert _entry(snap, 0).on_final_lap is True
        assert _entry(snap, 1).on_final_lap is False
        # Car 1 crosses the line: its final lap starts. Car 2 (lapped) too, later.
        snap = self._tick(engine, flags=0x2, state=4, laps=[(0, 21), (1, 21), (2, 19)])
        assert _entry(snap, 1).on_final_lap is True
        assert _entry(snap, 2).on_final_lap is False
        snap = self._tick(engine, flags=0x2, state=4, laps=[(0, 21), (1, 21), (2, 20)])
        assert _entry(snap, 2).on_final_lap is True

    def test_finish_follows_the_chequer_car_by_car(self):
        engine = StandingsEngine()
        self._tick(engine, flags=0x2, state=4, laps=[(0, 21), (1, 21), (2, 20)])
        # The leader takes the chequer: it is done, everyone else is on the last lap.
        snap = self._tick(engine, flags=0x1, state=5, laps=[(0, 22), (1, 21), (2, 20)])
        assert _entry(snap, 0).has_finished is True
        assert _entry(snap, 0).on_final_lap is False
        assert _entry(snap, 1).on_final_lap is True
        assert _entry(snap, 1).has_finished is False
        # Car 1 crosses the line after the chequer; car 2 has not yet.
        snap = self._tick(engine, flags=0x1, state=5, laps=[(0, 22), (1, 22), (2, 20)])
        assert _entry(snap, 1).has_finished is True
        assert _entry(snap, 2).on_final_lap is True
        assert snap.to_dict()["entries"][1]["hasFinished"] is True

    def test_a_chequer_without_a_white_still_counts(self):
        # Connected during the last lap: the white was never seen.
        engine = StandingsEngine()
        snap = self._tick(engine, flags=0x1, state=5, laps=[(0, 22), (1, 21)])
        assert _entry(snap, 0).has_finished is True
        assert _entry(snap, 1).on_final_lap is True

    def test_a_new_session_forgets_the_flags(self):
        engine = StandingsEngine()
        self._tick(engine, flags=0x1, state=5, laps=[(0, 22), (1, 21)])
        session = _session(session_num=1, sessions=[{}, {"SessionType": "Race"}])
        snap = engine.compute(
            session, _drivers_by_idx(session), {0: _timing(0, position=1, lap=1)}, 0
        )
        assert _entry(snap, 0).has_finished is False
        assert _entry(snap, 0).on_final_lap is False
