"""iRacing telemetry bridge (production, Windows).

Reads iRacing's shared memory via pyirsdk and publishes it over a WebSocket
(ws://localhost:8765), split into the ``telemetry`` / ``session`` / ``standings``
channels defined in :mod:`telemetrylab.protocol`.

This module is intentionally thin: it is only the *source* — it reads raw values
from the SDK and hands them to :class:`telemetrylab.BridgeService`, which owns
the cadences, repositories, change-detection and publishing. The mock bridge is
a different source plugged into the same service, so both emit identical wire
formats.

Windows only (pyirsdk reads Windows shared memory). For development on
macOS/Linux use ``mock_bridge.py``.
"""

from __future__ import annotations

import asyncio
import math
from typing import Any

import irsdk
from websockets.asyncio.server import serve

from telemetrylab import BridgeService, maybe_start_http_server
from telemetrylab.ingest import CAR_IDX_VARS

HOST = "0.0.0.0"
PORT = 8765


class IrsdkSource:
    """A :class:`telemetrylab.TelemetrySource` backed by pyirsdk.

    Owns the SDK connection lifecycle (startup/shutdown + reconnect) and exposes
    safe, typed reads. Reads that touch the live telemetry buffer freeze the
    latest frame first; the session YAML is read straight from the SDK's parsed
    cache (pyirsdk only re-parses it when iRacing changes the string).
    """

    def __init__(self) -> None:
        self.ir = irsdk.IRSDK()
        self._connected = False

    # --- connection ---------------------------------------------------------
    def poll_connection(self) -> bool:
        if self._connected and not (self.ir.is_initialized and self.ir.is_connected):
            self._connected = False
            self.ir.shutdown()
            print("[bridge] iRacing disconnected", flush=True)
        elif not self._connected and self.ir.startup() and self.ir.is_connected:
            self._connected = True
            print("[bridge] iRacing connected", flush=True)
        return self._connected

    # --- safe SDK access ----------------------------------------------------
    def _get(self, name: str, default: Any = None) -> Any:
        try:
            value = self.ir[name]
        except Exception:  # noqa: BLE001
            return default
        return default if value is None else value

    def _tyre(self, prefix: str) -> dict[str, Any]:
        return {
            "tempL": self._get(f"{prefix}tempCL"),
            "tempM": self._get(f"{prefix}tempCM"),
            "tempR": self._get(f"{prefix}tempCR"),
            "pressure": self._get(f"{prefix}press"),
        }

    # --- session ------------------------------------------------------------
    def read_session_raw(self) -> dict[str, Any] | None:
        session_info = self._get("SessionInfo") or {}
        return {
            "weekend_info": self._get("WeekendInfo") or {},
            "driver_info": self._get("DriverInfo") or {},
            "sessions": session_info.get("Sessions", []),
            # Sector boundaries for the standings screen's derived sector timing.
            "split_time_info": self._get("SplitTimeInfo") or {},
            "session_num": self._get("SessionNum", 0),
            "session_state": self._get("SessionState", 0),
            "session_time_remain": self._get("SessionTimeRemain"),
            "session_laps_remain": self._get("SessionLapsRemain"),
            "session_flags": self._get("SessionFlags", 0),
            "air_temp": self._get("AirTemp"),
            "track_temp": self._get("TrackTemp"),
            "player_car_idx": self._get("PlayerCarIdx", 0),
        }

    # --- player telemetry (60 Hz channel) -----------------------------------
    def read_player_frame(self) -> dict[str, Any] | None:
        self.ir.freeze_var_buffer_latest()
        speed = self._get("Speed", 0.0) or 0.0
        steer = self._get("SteeringWheelAngle", 0.0) or 0.0
        return {
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
            "lapDistPct": self._get("LapDistPct"),
            "playerCarPosition": self._get("PlayerCarPosition"),
            "playerCarClassPosition": self._get("PlayerCarClassPosition"),
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

    # --- multi-car arrays (standings channel) -------------------------------
    def read_car_arrays(self) -> dict[str, Any]:
        self.ir.freeze_var_buffer_latest()
        return {name: self._get(name) for name in CAR_IDX_VARS}


async def main() -> None:
    service = BridgeService(IrsdkSource())
    http_server = maybe_start_http_server()
    try:
        async with serve(service.publisher.register, HOST, PORT):
            print(f"[bridge] WebSocket server listening on ws://{HOST}:{PORT}", flush=True)
            await service.run()
    finally:
        if http_server is not None:
            http_server.stop()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("[bridge] shutting down", flush=True)
