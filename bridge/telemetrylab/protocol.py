"""Wire protocol shared by the real and mock bridges.

The bridge multiplexes several logical streams over a single WebSocket using a
small, versioned envelope. Splitting by ``type`` lets the frontend route each
message to the right store and lets us pick a different cadence per channel
(see :mod:`telemetrylab.service`) without ever shipping the heavy, rarely
changing data (the driver roster) at 60 fps.

Envelope
--------
Every message is a JSON object::

    {
      "v":       1,              # protocol version (bump on breaking changes)
      "type":    "telemetry",    # channel name, see CHANNELS
      "ts":      1719936000123,  # server wall-clock time, ms since epoch
      "seq":     4211,           # per-channel monotonic sequence number
      "payload": { ... }         # channel-specific, see telemetrylab.models
    }

``seq`` lets a client cheaply detect dropped/reordered frames per channel; a
client that only cares about the latest value can ignore it. ``v`` is the hook
for future migrations: the frontend can refuse or adapt to an unknown version
instead of silently mis-parsing.
"""

from __future__ import annotations

import time
from typing import Any, Final

PROTOCOL_VERSION: Final = 1


class Channel:
    """Logical stream names. Values are the ``type`` field on the wire."""

    #: ~60 Hz. Player car only: telemetry, inputs, current-lap data.
    TELEMETRY: Final = "telemetry"
    #: On change / ~1 Hz fallback. Driver roster + session/track/weather/SOF.
    SESSION: Final = "session"
    #: ~5–10 Hz. Computed field order, gaps, per-car timing, pit/track state.
    STANDINGS: Final = "standings"
    #: On change. Bridge/iRacing connection status (replaces the old heartbeat).
    BRIDGE: Final = "bridge"


#: Channels replayed to a client the instant it connects, so a late joiner sees
#: the current world immediately instead of waiting for the next tick. Telemetry
#: is intentionally excluded: it is ephemeral and the next frame is ~16 ms away.
SNAPSHOT_CHANNELS: Final = (Channel.BRIDGE, Channel.SESSION, Channel.STANDINGS)


def now_ms() -> int:
    """Server wall-clock timestamp in milliseconds (envelope ``ts``)."""
    return int(time.time() * 1000)


def envelope(channel: str, payload: Any, seq: int, ts: int | None = None) -> dict[str, Any]:
    """Wrap ``payload`` in the versioned channel envelope."""
    return {
        "v": PROTOCOL_VERSION,
        "type": channel,
        "ts": now_ms() if ts is None else ts,
        "seq": seq,
        "payload": payload,
    }
