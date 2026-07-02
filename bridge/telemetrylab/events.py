"""A tiny synchronous event bus.

The data-flow spec puts an Event Bus between the repositories and the publisher.
In a single-threaded asyncio bridge we don't need a broker — we need a decoupling
seam: repositories announce *what changed* (a driver joined, the flags went
green) without knowing who cares, and the publisher / future features (race
control, notifications, AI insights) subscribe. That keeps the ingest side free
of presentation concerns and makes new consumers a one-liner.

Events are plain, named records. Handlers must not block (this bus is called
inline from the ingest loops); do real work on the asyncio loop instead.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Callable


# --- Event types ------------------------------------------------------------
class Event:
    """Base marker for bus events."""


@dataclass(frozen=True, slots=True)
class SessionChanged(Event):
    """The parsed session (roster / track / rules) changed meaningfully."""
    session_id: str


@dataclass(frozen=True, slots=True)
class DriverJoined(Event):
    car_idx: int
    user_name: str


@dataclass(frozen=True, slots=True)
class DriverLeft(Event):
    car_idx: int
    user_name: str


@dataclass(frozen=True, slots=True)
class FlagsChanged(Event):
    flags: list[str]


@dataclass(frozen=True, slots=True)
class ConnectionChanged(Event):
    iracing_active: bool


Handler = Callable[[Event], None]


class EventBus:
    """Synchronous, typed publish/subscribe."""

    def __init__(self) -> None:
        self._handlers: dict[type[Event], list[Handler]] = defaultdict(list)
        self._any: list[Handler] = []

    def on(self, event_type: type[Event], handler: Handler) -> None:
        self._handlers[event_type].append(handler)

    def on_any(self, handler: Handler) -> None:
        """Subscribe to every event (useful for logging / a debug channel)."""
        self._any.append(handler)

    def emit(self, event: Event) -> None:
        for handler in self._handlers.get(type(event), ()):  # exact-type dispatch
            handler(event)
        for handler in self._any:
            handler(event)
