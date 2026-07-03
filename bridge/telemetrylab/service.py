"""The bridge service: wire a data source to the channel publisher.

This is the orchestration layer. It owns the three cadences the milestone calls
for and drives them off a single :class:`TelemetrySource` abstraction, so the
real (irsdk) and mock bridges are just different sources plugged into the same
machine.

    source ──▶ repositories ──▶ event bus ──▶ publisher ──▶ WebSocket
                    ▲                              │
                    └────────── this service ──────┘

Cadences (see the milestone's "update strategy"):
- telemetry  ~60 Hz  — player car only; ephemeral, never cached.
- standings  ~10 Hz  — computed field order; published only when it changes.
- session     ~1 Hz  — roster + rules + weather; published only on change.

Why these numbers: telemetry drives needles/animations that must feel
continuous, so it rides the sim's own 60 Hz. Standings move visibly but not
per-frame — 10 Hz is smooth for gap/position changes at a fraction of the bytes.
The roster is near-static; 1 Hz with change-detection means it ships on driver
swaps and as time ticks down, not 60×/s.
"""

from __future__ import annotations

import asyncio
from typing import Any, Protocol

from .events import ConnectionChanged, Event, EventBus
from .ingest import ingest_car_timings
from .protocol import Channel, now_ms
from .publisher import ChannelPublisher
from .repositories import CarRepository, SessionRepository

TELEMETRY_HZ = 60.0
STANDINGS_HZ = 10.0
SESSION_HZ = 1.0
DISCONNECTED_INTERVAL = 1.0


class TelemetrySource(Protocol):
    """What the service needs from a data source (irsdk or the mock)."""

    def poll_connection(self) -> bool:
        """Return whether iRacing/data is currently available (reconnect-aware)."""

    def read_session_raw(self) -> dict[str, Any] | None:
        """Raw snapshot for :func:`telemetrylab.parsing.parse_session_info`."""

    def read_player_frame(self) -> dict[str, Any] | None:
        """The player-only telemetry payload (see the telemetry channel schema)."""

    def read_car_arrays(self) -> dict[str, Any]:
        """The ``CarIdx*`` arrays keyed by SDK var name."""


class BridgeService:
    def __init__(self, source: TelemetrySource) -> None:
        self._source = source
        self._bus = EventBus()
        self._session_repo = SessionRepository(self._bus)
        self._car_repo = CarRepository(self._session_repo)
        self._publisher = ChannelPublisher()
        self._active = False
        self._bus.on_any(self._log_event)

    # --- introspection for the WebSocket server -----------------------------
    @property
    def publisher(self) -> ChannelPublisher:
        return self._publisher

    def _log_event(self, event: Event) -> None:
        print(f"[bridge] event: {type(event).__name__} {event}", flush=True)

    # --- connection handling ------------------------------------------------
    async def _set_active(self, active: bool) -> None:
        if active == self._active:
            return
        self._active = active
        self._bus.emit(ConnectionChanged(active))
        if not active:
            # Drop stale world so a fresh client doesn't inherit an old roster.
            self._session_repo = SessionRepository(self._bus)
            self._car_repo = CarRepository(self._session_repo)
        await self._publisher.publish(Channel.BRIDGE, {"iracingActive": active})

    # --- loops --------------------------------------------------------------
    async def _session_loop(self) -> None:
        """Owns connection polling (slow path) + the session channel."""
        while True:
            active = self._source.poll_connection()
            await self._set_active(active)

            if active:
                raw = self._source.read_session_raw()
                if raw is not None and self._session_repo.update(raw):
                    snap = self._session_repo.snapshot()
                    if snap is not None:
                        await self._publisher.publish(Channel.SESSION, snap)
                await asyncio.sleep(1.0 / SESSION_HZ)
            else:
                await asyncio.sleep(DISCONNECTED_INTERVAL)

    async def _standings_loop(self) -> None:
        while True:
            if not self._active:
                await asyncio.sleep(DISCONNECTED_INTERVAL)
                continue
            session = self._session_repo.current
            if session is not None:
                arrays = self._source.read_car_arrays()
                timings = ingest_car_timings(
                    arrays,
                    timestamp=now_ms(),
                    player_car_idx=session.driver_car_idx,
                    est_lap_time=session.car_est_lap_time,
                    include=self._session_repo.drivers_by_idx.keys(),
                )
                self._car_repo.update(timings)
                snapshot = self._car_repo.compute(session.driver_car_idx)
                wire = snapshot.to_dict()
                if self._car_repo.standings_changed(wire):
                    await self._publisher.publish(Channel.STANDINGS, wire)
            await asyncio.sleep(1.0 / STANDINGS_HZ)

    async def _telemetry_loop(self) -> None:
        while True:
            if not self._active:
                await asyncio.sleep(DISCONNECTED_INTERVAL)
                continue
            frame = self._source.read_player_frame()
            if frame is not None:
                await self._publisher.publish(Channel.TELEMETRY, frame)
            await asyncio.sleep(1.0 / TELEMETRY_HZ)

    async def run(self) -> None:
        """Run all channel loops until cancelled."""
        await asyncio.gather(
            self._session_loop(),
            self._standings_loop(),
            self._telemetry_loop(),
        )
