"""WebSocket channel publisher.

Owns the set of connected frontends and multiplexes the logical channels
(telemetry / session / standings / bridge) over each socket using the envelope
in :mod:`telemetrylab.protocol`.

Two behaviours matter for a good client experience:

- **Per-channel sequence numbers** so a client can detect drops.
- **Snapshot-on-connect**: a client that joins mid-session must not wait up to a
  second to learn the roster/standings. We cache the latest payload of each
  stateful channel and replay it the instant a socket opens. Telemetry is not
  cached — the next 60 Hz frame is milliseconds away.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

from websockets.asyncio.server import ServerConnection

from .protocol import SNAPSHOT_CHANNELS, envelope


class ChannelPublisher:
    def __init__(self) -> None:
        self._clients: set[ServerConnection] = set()
        self._seq: dict[str, int] = {}
        self._snapshots: dict[str, dict[str, Any]] = {}

    # --- client lifecycle ---------------------------------------------------
    async def register(self, connection: ServerConnection) -> None:
        """Register a client, replay snapshots, and block until it disconnects."""
        self._clients.add(connection)
        peer = connection.remote_address
        print(f"[bridge] client connected: {peer}", flush=True)
        try:
            # Replay the current world so late joiners render immediately.
            for channel in SNAPSHOT_CHANNELS:
                snap = self._snapshots.get(channel)
                if snap is not None:
                    await connection.send(json.dumps(snap))
            await connection.wait_closed()
        finally:
            self._clients.discard(connection)
            print(f"[bridge] client disconnected: {peer}", flush=True)

    @property
    def client_count(self) -> int:
        return len(self._clients)

    # --- publishing ---------------------------------------------------------
    async def publish(self, channel: str, payload: Any) -> None:
        """Envelope ``payload`` on ``channel`` and broadcast to all clients."""
        seq = self._seq.get(channel, 0)
        self._seq[channel] = seq + 1
        message = envelope(channel, payload, seq)

        # Cache stateful channels for snapshot-on-connect (store the full
        # envelope; the replayed seq/ts are historical but harmless).
        if channel in SNAPSHOT_CHANNELS:
            self._snapshots[channel] = message

        if not self._clients:
            return
        data = json.dumps(message)
        await asyncio.gather(
            *(client.send(data) for client in list(self._clients)),
            return_exceptions=True,
        )
