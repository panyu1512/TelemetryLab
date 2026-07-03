"""Integration tests for :class:`BridgeService`.

These drive the real orchestration (connection polling + the three channel
loops) with a fake source and a fake publisher, so the wiring between source →
repositories → publisher is exercised without a socket or iRacing.
"""

from __future__ import annotations

import asyncio
import contextlib

from telemetrylab.protocol import Channel
from telemetrylab.service import BridgeService

from .conftest import make_driver, make_session_raw


class FakePublisher:
    """Records every publish so tests can assert what went on the wire."""

    def __init__(self) -> None:
        self.published: list[tuple[str, object]] = []

    async def publish(self, channel: str, payload: object) -> None:
        self.published.append((channel, payload))

    def channels(self) -> set[str]:
        return {c for c, _ in self.published}

    def payloads(self, channel: str) -> list[object]:
        return [p for c, p in self.published if c == channel]


class FakeSource:
    """A scriptable :class:`TelemetrySource`."""

    def __init__(self, *, active: bool = True) -> None:
        self.active = active
        self._session = make_session_raw(
            drivers=[make_driver(0, car_class_id=1), make_driver(1, car_class_id=1)]
        )

    def poll_connection(self) -> bool:
        return self.active

    def read_session_raw(self):
        return self._session

    def read_player_frame(self):
        return {"speed": 240.0, "gear": 4}

    def read_car_arrays(self):
        return {
            "CarIdxPosition": [1, 2],
            "CarIdxLap": [10, 10],
            "CarIdxTrackSurface": [3, 3],
            "CarIdxF2Time": [0.0, 1.4],
        }


async def _run_briefly(service: BridgeService, seconds: float = 0.3) -> None:
    """Run the service loops for a short window, then cancel cleanly."""
    task = asyncio.create_task(service.run())
    await asyncio.sleep(seconds)
    task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await task


def _drive(service: BridgeService, seconds: float = 0.3) -> None:
    asyncio.run(_run_briefly(service, seconds))


class TestBridgeServiceActive:
    def test_publishes_all_channels_when_active(self):
        service = BridgeService(FakeSource(active=True))
        pub = FakePublisher()
        service._publisher = pub  # inject the recorder
        _drive(service)
        channels = pub.channels()
        assert Channel.BRIDGE in channels
        assert Channel.SESSION in channels
        assert Channel.STANDINGS in channels
        assert Channel.TELEMETRY in channels

    def test_bridge_status_reports_active(self):
        service = BridgeService(FakeSource(active=True))
        pub = FakePublisher()
        service._publisher = pub
        _drive(service)
        bridge_msgs = pub.payloads(Channel.BRIDGE)
        assert bridge_msgs[0] == {"iracingActive": True}

    def test_session_payload_has_roster(self):
        service = BridgeService(FakeSource(active=True))
        pub = FakePublisher()
        service._publisher = pub
        _drive(service)
        session_payloads = pub.payloads(Channel.SESSION)
        assert session_payloads
        assert len(session_payloads[0]["drivers"]) == 2

    def test_standings_change_detection_avoids_dupes(self):
        # The source returns identical arrays each tick, so after the first
        # standings frame the change-detector should suppress the rest.
        service = BridgeService(FakeSource(active=True))
        pub = FakePublisher()
        service._publisher = pub
        _drive(service, seconds=0.4)
        standings = pub.payloads(Channel.STANDINGS)
        # A handful of distinct frames at most (timestamps differ only inside the
        # engine, not on the wire) — certainly not one per 100 ms tick.
        assert 1 <= len(standings) <= 3


class TestBridgeServiceInactive:
    def test_starting_inactive_publishes_nothing(self):
        # No transition from the default (inactive) state → no bridge frame, and
        # certainly no session/telemetry data.
        service = BridgeService(FakeSource(active=False))
        pub = FakePublisher()
        service._publisher = pub
        _drive(service, seconds=0.2)
        assert pub.published == []

    def test_transition_to_inactive_is_announced(self):
        # Start active (announces active), then drop the connection: the service
        # must announce the disconnect exactly once.
        source = FakeSource(active=True)
        service = BridgeService(source)
        pub = FakePublisher()
        service._publisher = pub

        async def scenario():
            task = asyncio.create_task(service.run())
            await asyncio.sleep(0.2)
            source.active = False  # iRacing goes away
            # The session loop only re-polls the connection once per second, so
            # wait past that cadence for the disconnect to be observed.
            await asyncio.sleep(1.3)
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

        asyncio.run(scenario())
        bridge_states = [p["iracingActive"] for p in pub.payloads(Channel.BRIDGE)]
        assert bridge_states == [True, False]
