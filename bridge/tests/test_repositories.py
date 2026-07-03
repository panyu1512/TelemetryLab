"""Tests for the in-memory session/car repositories and their change detection."""

from __future__ import annotations

from telemetrylab import events
from telemetrylab.events import EventBus
from telemetrylab.ingest import ingest_car_timings
from telemetrylab.repositories import CarRepository, SessionRepository

from .conftest import make_driver, make_session_raw


class _Recorder:
    def __init__(self, bus: EventBus) -> None:
        self.seen: list[events.Event] = []
        bus.on_any(self.seen.append)

    def types(self) -> list[str]:
        return [type(e).__name__ for e in self.seen]


class TestSessionRepository:
    def test_first_update_returns_true_and_emits(self):
        bus = EventBus()
        rec = _Recorder(bus)
        repo = SessionRepository(bus)
        assert repo.update(make_session_raw()) is True
        assert "SessionChanged" in rec.types()
        assert repo.current is not None

    def test_identical_update_is_noop(self):
        bus = EventBus()
        repo = SessionRepository(bus)
        raw = make_session_raw()
        assert repo.update(raw) is True
        assert repo.update(raw) is False  # nothing changed

    def test_driver_join_emitted(self):
        bus = EventBus()
        rec = _Recorder(bus)
        repo = SessionRepository(bus)
        repo.update(make_session_raw(drivers=[make_driver(0, user_name="A")]))
        repo.update(
            make_session_raw(drivers=[make_driver(0, user_name="A"), make_driver(1, user_name="B")])
        )
        joins = [e for e in rec.seen if isinstance(e, events.DriverJoined)]
        assert any(e.user_name == "B" for e in joins)

    def test_driver_leave_emitted(self):
        bus = EventBus()
        rec = _Recorder(bus)
        repo = SessionRepository(bus)
        repo.update(
            make_session_raw(drivers=[make_driver(0, user_name="A"), make_driver(1, user_name="B")])
        )
        repo.update(make_session_raw(drivers=[make_driver(0, user_name="A")]))
        leaves = [e for e in rec.seen if isinstance(e, events.DriverLeft)]
        assert any(e.user_name == "B" for e in leaves)

    def test_driver_swap_same_slot_new_user_is_join(self):
        bus = EventBus()
        rec = _Recorder(bus)
        repo = SessionRepository(bus)
        repo.update(make_session_raw(drivers=[make_driver(0, user_id=1, user_name="A")]))
        repo.update(make_session_raw(drivers=[make_driver(0, user_id=2, user_name="C")]))
        joins = [e for e in rec.seen if isinstance(e, events.DriverJoined)]
        assert any(e.user_name == "C" for e in joins)

    def test_flags_change_emitted_once(self):
        bus = EventBus()
        rec = _Recorder(bus)
        repo = SessionRepository(bus)
        repo.update(make_session_raw(session_flags=0x00000008))  # yellow
        repo.update(make_session_raw(session_flags=0x00000004))  # green
        flag_events = [e for e in rec.seen if isinstance(e, events.FlagsChanged)]
        assert [e.flags for e in flag_events][-1] == ["green"]

    def test_drivers_by_idx_indexed(self):
        bus = EventBus()
        repo = SessionRepository(bus)
        repo.update(make_session_raw(drivers=[make_driver(0), make_driver(4)]))
        assert set(repo.drivers_by_idx) == {0, 4}

    def test_snapshot_matches_current(self):
        bus = EventBus()
        repo = SessionRepository(bus)
        repo.update(make_session_raw())
        assert repo.snapshot() == repo.current.to_dict()


class TestCarRepository:
    def _seed_session(self):
        bus = EventBus()
        session_repo = SessionRepository(bus)
        session_repo.update(
            make_session_raw(
                drivers=[make_driver(0, car_class_id=1), make_driver(1, car_class_id=1)]
            )
        )
        return session_repo

    def test_compute_without_session_returns_empty(self):
        session_repo = SessionRepository(EventBus())  # never updated
        car_repo = CarRepository(session_repo)
        snap = car_repo.compute(player_car_idx=0)
        assert snap.entries == []
        assert snap.player_car_idx == 0

    def test_compute_produces_entries(self):
        session_repo = self._seed_session()
        car_repo = CarRepository(session_repo)
        arrays = {
            "CarIdxPosition": [1, 2],
            "CarIdxLap": [10, 10],
            "CarIdxTrackSurface": [3, 3],
            "CarIdxF2Time": [0.0, 1.0],
        }
        timings = ingest_car_timings(
            arrays, timestamp=0, player_car_idx=0, est_lap_time=90.0, include=[0, 1]
        )
        car_repo.update(timings)
        snap = car_repo.compute(player_car_idx=0)
        assert len(snap.entries) == 2

    def test_standings_change_detection(self):
        session_repo = self._seed_session()
        car_repo = CarRepository(session_repo)
        wire = {"entries": [], "foo": 1}
        assert car_repo.standings_changed(wire) is True
        assert car_repo.standings_changed(wire) is False  # identical
        assert car_repo.standings_changed({"entries": [], "foo": 2}) is True
