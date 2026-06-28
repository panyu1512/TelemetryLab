"""Mock telemetry bridge for development without iRacing.

Emits the exact same WebSocket protocol as ``bridge.py`` but generates
synthetic, realistic-looking telemetry so the frontend can be developed on
macOS/Linux (or on Windows without iRacing running).

Only depends on ``websockets`` (no pyirsdk), so it runs anywhere:

    pip install websockets
    python bridge/mock_bridge.py

Set ``MOCK_DISCONNECT_EVERY`` to a number of seconds to periodically simulate
iRacing going away (emits ``{"connected": false}``) to exercise the UI states.
"""

from __future__ import annotations

import asyncio
import json
import math
import os
import time
from typing import Any, Set

from websockets.asyncio.server import ServerConnection, serve

HOST = "0.0.0.0"
PORT = 8765

TICK_HZ = 60.0
CONNECTED_INTERVAL = 1.0 / TICK_HZ
DISCONNECTED_INTERVAL = 1.0

# If > 0, alternate between "iRacing active" and "iRacing closed" every N seconds.
DISCONNECT_EVERY = float(os.environ.get("MOCK_DISCONNECT_EVERY", "0") or 0)

# Simple lap model so lap timer / fuel evolve sensibly.
LAP_TIME = 92.0  # seconds per lap
TANK_CAPACITY = 60.0  # litres


def _tyre(base: float, t: float, idx: float) -> dict[str, Any]:
    """Generate a plausible tyre reading that breathes around ``base`` °C."""
    wobble = 6.0 * math.sin(t * 0.5 + idx)
    return {
        "tempL": round(base + wobble - 4.0, 1),
        "tempM": round(base + wobble, 1),
        "tempR": round(base + wobble + 3.0, 1),
        "pressure": round(165.0 + 4.0 * math.sin(t * 0.2 + idx), 1),  # kPa
    }


def sample(t: float) -> dict[str, Any]:
    """Build one synthetic telemetry frame for elapsed time ``t`` seconds."""
    # Speed/RPM follow a smooth lap-like profile (accelerate, brake, repeat).
    lap_phase = (t % LAP_TIME) / LAP_TIME  # 0..1 around the lap
    throttle_wave = (math.sin(t * 0.8) + 1.0) / 2.0
    braking = max(0.0, math.sin(t * 0.8 + math.pi)) * (1.0 if throttle_wave < 0.3 else 0.0)

    speed_kmh = 80.0 + 140.0 * throttle_wave  # ~80..220 km/h
    speed_ms = speed_kmh / 3.6
    rpm = 4000.0 + 4500.0 * throttle_wave
    gear = max(1, min(6, int(1 + throttle_wave * 5)))

    steer_rad = 0.6 * math.sin(t * 0.6)
    fuel_pct = max(0.05, 1.0 - (t % (LAP_TIME * 20)) / (LAP_TIME * 20))

    lap_number = int(t // LAP_TIME) + 1
    current_lap_time = t % LAP_TIME

    return {
        "connected": True,
        "sessionTime": round(t, 3),
        "speed": round(speed_ms, 3),
        "speedKmh": round(speed_kmh, 1),
        "rpm": round(rpm),
        "gear": gear,
        "throttle": round(throttle_wave, 3),
        "brake": round(braking, 3),
        "steeringWheelAngle": round(steer_rad, 4),
        "steeringDeg": round(math.degrees(steer_rad), 1),
        "fuelLevel": round(TANK_CAPACITY * fuel_pct, 2),
        "fuelLevelPct": round(fuel_pct, 3),
        "lapCurrentLapTime": round(current_lap_time, 3),
        "lapBestLapTime": round(LAP_TIME - 1.2, 3),
        "lapLastLapTime": round(LAP_TIME + 0.4, 3),
        "lap": lap_number,
        "playerCarPosition": 3,
        "latAccel": round(9.0 * math.sin(t * 0.6), 2),
        "lonAccel": round(6.0 * (throttle_wave - braking), 2),
        "onPitRoad": lap_phase < 0.02,
        "airTemp": 24.0,
        "trackTemp": round(30.0 + 2.0 * math.sin(t * 0.05), 1),
        "tyres": {
            "lf": _tyre(85.0, t, 0.0),
            "rf": _tyre(88.0, t, 1.0),
            "lr": _tyre(80.0, t, 2.0),
            "rr": _tyre(82.0, t, 3.0),
        },
    }


clients: Set[ServerConnection] = set()


async def register(connection: ServerConnection) -> None:
    clients.add(connection)
    print(f"[mock] client connected: {connection.remote_address}", flush=True)
    try:
        await connection.wait_closed()
    finally:
        clients.discard(connection)
        print(f"[mock] client disconnected: {connection.remote_address}", flush=True)


async def broadcast(message: str) -> None:
    if not clients:
        return
    await asyncio.gather(
        *(client.send(message) for client in list(clients)),
        return_exceptions=True,
    )


def is_active(elapsed: float) -> bool:
    """Toggle a fake iRacing session on/off when DISCONNECT_EVERY is set."""
    if DISCONNECT_EVERY <= 0:
        return True
    cycle = elapsed % (DISCONNECT_EVERY * 2)
    return cycle < DISCONNECT_EVERY


async def telemetry_loop() -> None:
    start = time.monotonic()
    while True:
        elapsed = time.monotonic() - start
        if is_active(elapsed):
            await broadcast(json.dumps(sample(elapsed)))
            await asyncio.sleep(CONNECTED_INTERVAL)
        else:
            await broadcast(json.dumps({"connected": False}))
            await asyncio.sleep(DISCONNECTED_INTERVAL)


async def main() -> None:
    async with serve(register, HOST, PORT):
        print(f"[mock] WebSocket server listening on ws://{HOST}:{PORT}", flush=True)
        if DISCONNECT_EVERY > 0:
            print(f"[mock] simulating disconnects every {DISCONNECT_EVERY}s", flush=True)
        await telemetry_loop()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("[mock] shutting down", flush=True)
