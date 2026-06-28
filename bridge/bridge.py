"""iRacing telemetry bridge.

Reads iRacing's shared memory via pyirsdk at ~60 fps and broadcasts the
telemetry as JSON over a WebSocket server (ws://localhost:8765).

Protocol
--------
- When iRacing is active, each frame is a JSON object with ``"connected": true``
  plus the telemetry fields (see ``Bridge.sample``).
- When iRacing is not running, the bridge emits ``{"connected": false}`` once per
  second.

The bridge handles iRacing being closed and reopened: it keeps polling the SDK
and transparently reconnects when a session becomes available again.

This module only runs on Windows (pyirsdk reads the Windows shared memory).
For development on macOS/Linux use ``mock_bridge.py`` instead.
"""

from __future__ import annotations

import asyncio
import json
import math
from typing import Any, Optional, Set

import irsdk
from websockets.asyncio.server import ServerConnection, serve

HOST = "0.0.0.0"
PORT = 8765

# Target sampling rate while connected to iRacing.
TICK_HZ = 60.0
CONNECTED_INTERVAL = 1.0 / TICK_HZ
# How often to emit the "disconnected" heartbeat while iRacing is closed.
DISCONNECTED_INTERVAL = 1.0


class Bridge:
    """Thin wrapper around pyirsdk with safe variable access + reconnection."""

    def __init__(self) -> None:
        self.ir = irsdk.IRSDK()
        self.connected = False

    def check_connection(self) -> None:
        """Sync our connection flag with the live SDK state.

        Detects iRacing closing (shutdown + flag reset) and reopening
        (startup) so the bridge recovers automatically.
        """
        if self.connected and not (
            self.ir.is_initialized and self.ir.is_connected
        ):
            self.connected = False
            self.ir.shutdown()
            print("[bridge] iRacing disconnected", flush=True)
        elif not self.connected and self.ir.startup() and self.ir.is_connected:
            self.connected = True
            print("[bridge] iRacing connected", flush=True)

    def _get(self, name: str, default: Any = None) -> Any:
        """Read a telemetry var, returning ``default`` if absent/unavailable."""
        try:
            value = self.ir[name]
        except Exception:  # noqa: BLE001
            return default
        return default if value is None else value

    def _tyre(self, prefix: str) -> dict[str, Any]:
        """Per-tyre carcass temperatures (L/M/R) and pressure.

        Prefixes: ``LF``, ``RF``, ``LR``, ``RR``. Some of these vars are only
        exposed by iRacing in certain situations, hence the safe ``_get``.
        """
        return {
            "tempL": self._get(f"{prefix}tempCL"),
            "tempM": self._get(f"{prefix}tempCM"),
            "tempR": self._get(f"{prefix}tempCR"),
            "pressure": self._get(f"{prefix}press"),
        }

    def sample(self) -> dict[str, Any]:
        """Read one telemetry frame from the latest shared-memory buffer."""
        self.ir.freeze_var_buffer_latest()

        speed = self._get("Speed", 0.0) or 0.0
        steer = self._get("SteeringWheelAngle", 0.0) or 0.0

        return {
            "connected": True,
            "sessionTime": self._get("SessionTime"),
            "speed": speed,
            "speedKmh": round(speed * 3.6, 1),
            "rpm": self._get("RPM"),
            "gear": self._get("Gear"),
            "throttle": self._get("Throttle"),
            "brake": self._get("Brake"),
            "steeringWheelAngle": steer,
            "steeringDeg": round(math.degrees(steer), 1),
            "fuelLevel": self._get("FuelLevel"),
            "fuelLevelPct": self._get("FuelLevelPct"),
            "lapCurrentLapTime": self._get("LapCurrentLapTime"),
            "lapBestLapTime": self._get("LapBestLapTime"),
            "lapLastLapTime": self._get("LapLastLapTime"),
            "lap": self._get("Lap"),
            "playerCarPosition": self._get("PlayerCarPosition"),
            "latAccel": self._get("LatAccel"),
            "lonAccel": self._get("LonAccel"),
            "onPitRoad": self._get("OnPitRoad"),
            "airTemp": self._get("AirTemp"),
            "trackTemp": self._get("TrackTemp"),
            "tyres": {
                "lf": self._tyre("LF"),
                "rf": self._tyre("RF"),
                "lr": self._tyre("LR"),
                "rr": self._tyre("RR"),
            },
        }


# Currently connected WebSocket clients (frontends).
clients: Set[ServerConnection] = set()


async def register(connection: ServerConnection) -> None:
    """Handle a client connection: register it and wait until it disconnects."""
    clients.add(connection)
    peer = connection.remote_address
    print(f"[bridge] client connected: {peer}", flush=True)
    try:
        await connection.wait_closed()
    finally:
        clients.discard(connection)
        print(f"[bridge] client disconnected: {peer}", flush=True)


async def broadcast(message: str) -> None:
    """Send a message to every connected client, dropping the ones that fail."""
    if not clients:
        return
    await asyncio.gather(
        *(client.send(message) for client in list(clients)),
        return_exceptions=True,
    )


async def telemetry_loop() -> None:
    """Poll iRacing and broadcast frames forever."""
    bridge = Bridge()
    while True:
        bridge.check_connection()
        if bridge.connected:
            try:
                payload: dict[str, Any] = bridge.sample()
                interval = CONNECTED_INTERVAL
            except Exception as exc:  # noqa: BLE001
                # A read failure usually means iRacing went away mid-frame.
                print(f"[bridge] sample error: {exc}", flush=True)
                payload = {"connected": False}
                interval = DISCONNECTED_INTERVAL
        else:
            payload = {"connected": False}
            interval = DISCONNECTED_INTERVAL

        await broadcast(json.dumps(payload))
        await asyncio.sleep(interval)


async def main() -> None:
    async with serve(register, HOST, PORT):
        print(f"[bridge] WebSocket server listening on ws://{HOST}:{PORT}", flush=True)
        await telemetry_loop()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("[bridge] shutting down", flush=True)
