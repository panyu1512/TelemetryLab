"""In-memory repositories: the source of truth for session + car state.

These sit between raw ingest and the publisher. They own the *current* world,
detect meaningful change (so we don't re-broadcast identical data), and announce
domain events on the bus. They hold no I/O — feeding them is the bridge's job —
which keeps them trivially unit-testable and reusable by the real and mock
bridges alike.
"""

from __future__ import annotations

from typing import Any, Optional

from . import events
from .events import EventBus
from .models import CarTiming, DriverEntry, SessionInfo, StandingsSnapshot
from .parsing import parse_session_info
from .protocol import now_ms
from .standings import StandingsEngine


class SessionRepository:
    """Owns the current :class:`SessionInfo` and driver roster.

    Handles the messy lifecycle the field goes through: drivers joining/leaving,
    reconnects (same ``userId`` reappearing on a ``carIdx``), driver swaps in
    team races, and replay mode (where the roster is fully populated up front).
    Change is detected by comparing the serialized snapshot, so any field moving
    — a swap, a flag, time ticking down — surfaces without bespoke diff logic.
    """

    def __init__(self, bus: EventBus) -> None:
        self._bus = bus
        self._current: Optional[SessionInfo] = None
        self._last_wire: Optional[dict[str, Any]] = None
        self._drivers_by_idx: dict[int, DriverEntry] = {}
        self._last_flags: list[str] = []

    def update(self, raw: dict[str, Any]) -> bool:
        """Ingest a raw source snapshot. Returns True if anything changed."""
        session = parse_session_info(raw)
        wire = session.to_dict()
        if wire == self._last_wire:
            return False

        prev_ids = {d.car_idx: d for d in self._current.drivers} if self._current else {}
        self._diff_roster(prev_ids, {d.car_idx: d for d in session.drivers})

        if session.flags != self._last_flags:
            self._bus.emit(events.FlagsChanged(session.flags))
            self._last_flags = session.flags

        self._current = session
        self._last_wire = wire
        self._drivers_by_idx = {d.car_idx: d for d in session.drivers}
        self._bus.emit(events.SessionChanged(session.session_id))
        return True

    def _diff_roster(
        self,
        prev: dict[int, DriverEntry],
        now: dict[int, DriverEntry],
    ) -> None:
        for idx, driver in now.items():
            old = prev.get(idx)
            # New slot, or the same slot taken over by a different user (swap /
            # reconnect into a freed car): treat as a join.
            if old is None or old.user_id != driver.user_id:
                if driver.user_name:
                    self._bus.emit(events.DriverJoined(idx, driver.user_name))
        for idx, driver in prev.items():
            if idx not in now and driver.user_name:
                self._bus.emit(events.DriverLeft(idx, driver.user_name))

    @property
    def current(self) -> Optional[SessionInfo]:
        return self._current

    @property
    def drivers_by_idx(self) -> dict[int, DriverEntry]:
        return self._drivers_by_idx

    def snapshot(self) -> Optional[dict[str, Any]]:
        return self._last_wire


class CarRepository:
    """Owns the latest per-car timing and derives the standings snapshot.

    Kept separate from the roster because it updates an order of magnitude more
    often (standings tick vs. session change). The standings computation joins
    the two on demand.
    """

    def __init__(self, session_repo: SessionRepository) -> None:
        self._session_repo = session_repo
        self._timings: dict[int, CarTiming] = {}
        self._last_standings_wire: Optional[dict[str, Any]] = None
        # The engine carries cross-tick history (sectors, start grid, best laps);
        # it lives as long as this repository, and resets itself on session change.
        self._engine = StandingsEngine()

    def update(self, timings: dict[int, CarTiming]) -> None:
        self._timings = timings

    @property
    def timings(self) -> dict[int, CarTiming]:
        return self._timings

    def compute(self, player_car_idx: int) -> StandingsSnapshot:
        session = self._session_repo.current
        if session is None:
            return StandingsSnapshot(player_car_idx=player_car_idx)
        return self._engine.compute(
            session,
            self._session_repo.drivers_by_idx,
            self._timings,
            now_ms(),
        )

    def standings_changed(self, wire: dict[str, Any]) -> bool:
        """True if this standings payload differs from the last one emitted."""
        if wire == self._last_standings_wire:
            return False
        self._last_standings_wire = wire
        return True

    def snapshot(self) -> Optional[dict[str, Any]]:
        return self._last_standings_wire
