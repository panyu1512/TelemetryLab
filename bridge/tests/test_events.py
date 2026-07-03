"""Tests for the synchronous event bus."""

from __future__ import annotations

from telemetrylab.events import (
    ConnectionChanged,
    DriverJoined,
    EventBus,
    FlagsChanged,
    SessionChanged,
)


class TestEventBus:
    def test_exact_type_dispatch(self):
        bus = EventBus()
        seen = []
        bus.on(DriverJoined, lambda e: seen.append(e))
        bus.emit(DriverJoined(car_idx=3, user_name="Alonso"))
        bus.emit(FlagsChanged(flags=["green"]))  # different type — ignored
        assert len(seen) == 1
        assert seen[0].car_idx == 3

    def test_multiple_handlers_same_type(self):
        bus = EventBus()
        calls = []
        bus.on(FlagsChanged, lambda e: calls.append("a"))
        bus.on(FlagsChanged, lambda e: calls.append("b"))
        bus.emit(FlagsChanged(flags=["yellow"]))
        assert calls == ["a", "b"]

    def test_on_any_receives_everything(self):
        bus = EventBus()
        seen = []
        bus.on_any(lambda e: seen.append(type(e).__name__))
        bus.emit(SessionChanged(session_id="x"))
        bus.emit(ConnectionChanged(iracing_active=True))
        assert seen == ["SessionChanged", "ConnectionChanged"]

    def test_no_handlers_is_noop(self):
        # Emitting with nobody subscribed must not raise.
        EventBus().emit(DriverJoined(car_idx=0, user_name="Nobody"))

    def test_events_are_frozen(self):
        import dataclasses

        import pytest

        e = FlagsChanged(flags=["green"])
        with pytest.raises(dataclasses.FrozenInstanceError):
            e.flags = ["red"]  # type: ignore[misc]
