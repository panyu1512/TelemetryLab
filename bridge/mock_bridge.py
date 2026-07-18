"""Mock telemetry bridge for development without iRacing.

Speaks the exact same channel protocol as ``bridge.py`` (via the shared
:class:`telemetrylab.BridgeService`) but synthesizes a whole field: a roster of
AI + human-looking drivers across one or two classes, all circulating the track
at different paces, so the v0.3+ session / standings / relative screens can be
built entirely on macOS/Linux.

    pip install websockets
    python bridge/mock_bridge.py

Environment knobs:
  MOCK_CARS=20            number of cars in the field
  MOCK_MULTICLASS=1       split the field into GT3 + GT4 (0 = single class)
  MOCK_DISCONNECT_EVERY=0 seconds; >0 toggles iRacing on/off to exercise the UI
"""

from __future__ import annotations

import asyncio
import math
import os
import random
import time
from typing import Any

from websockets.asyncio.server import serve

from telemetrylab import BridgeService

HOST = "0.0.0.0"
PORT = 8765

FIELD_SIZE = int(os.environ.get("MOCK_CARS", "20") or 20)
MULTICLASS = (os.environ.get("MOCK_MULTICLASS", "1") or "1") != "0"
DISCONNECT_EVERY = float(os.environ.get("MOCK_DISCONNECT_EVERY", "0") or 0)

RACE_LENGTH = 3600.0  # seconds of session
TANK_CAPACITY = 60.0  # litres

# Two fictitious classes so multi-class rendering can be exercised.
CLASS_GT3 = {"id": 84, "short": "GT3", "color": 0xFF4D4D, "base_lap": 138.0}
CLASS_GT4 = {"id": 85, "short": "GT4", "color": 0x4D9DFF, "base_lap": 150.0}

_FIRST = [
    "Kike",
    "Matt",
    "Ana",
    "Luca",
    "Sven",
    "Yuki",
    "Pia",
    "Omar",
    "Nils",
    "Rui",
    "Ivo",
    "Tom",
    "Kai",
    "Zoe",
    "Max",
    "Lea",
    "Jon",
    "Eva",
    "Sam",
    "Nia",
    "Rex",
    "Ada",
    "Leo",
    "Mia",
]
# (FlairName, FlairShortName) pairs, mirroring iRacing's driver flair fields.
_COUNTRIES = [
    ("Spain", "ESP"),
    ("United Kingdom", "GBR"),
    ("Portugal", "PRT"),
    ("Italy", "ITA"),
    ("Sweden", "SWE"),
    ("Japan", "JPN"),
    ("Germany", "DEU"),
    ("Egypt", "EGY"),
    ("Mexico", "MEX"),
    ("France", "FRA"),
    ("Netherlands", "NLD"),
    ("United States", "USA"),
    ("Brazil", "BRA"),
    ("Australia", "AUS"),
    ("Finland", "FIN"),
    ("Belgium", "BEL"),
]

_LAST = [
    "Ferrer",
    "Farrow",
    "Silva",
    "Rossi",
    "Berg",
    "Tanaka",
    "Costa",
    "Haddad",
    "Vega",
    "Moreau",
    "Klein",
    "Novak",
    "Reyes",
    "Falk",
]


class MockCar:
    """A synthetic competitor with a stable identity and a per-lap pace."""

    def __init__(self, idx: int, rng: random.Random, klass: dict[str, Any]) -> None:
        self.idx = idx
        self.klass = klass
        self.number = str(rng.randint(1, 199))
        self.user_id = 100000 + idx
        self.name = f"{rng.choice(_FIRST)} {rng.choice(_LAST)}"
        self.is_ai = idx != 0 and rng.random() < 0.5
        self.country_name, self.country_code = rng.choice(_COUNTRIES)
        self.irating = max(600, int(rng.gauss(2200 if klass is CLASS_GT3 else 1600, 700)))
        sr = round(rng.uniform(1.5, 4.99), 2)
        grp = "A" if sr > 4 else "B" if sr > 3 else "C" if sr > 2 else "D"
        self.license_string = f"{grp} {sr:.2f}"
        self.lic_sub = int(sr * 100)
        self.lic_level = {"A": 13, "B": 9, "C": 5, "D": 3}[grp]
        # Pace: faster drivers (higher iR) lap a touch quicker; add jitter.
        self.pace = klass["base_lap"] * (1.0 + (2200 - self.irating) / 40000.0)
        self.phase = rng.uniform(0.0, 0.4)  # grid stagger (fraction of a lap)
        self.wobble = rng.uniform(0.3, 1.2)  # lap-time variation amplitude
        self.pit_at = rng.uniform(0.35, 0.85) if rng.random() < 0.25 else None

    # --- dynamics -----------------------------------------------------------
    def lap_time(self, t: float) -> float:
        return self.pace + self.wobble * math.sin(t * 0.03 + self.idx)

    def progress(self, t: float) -> float:
        """Total laps completed (float): integer part = lap, frac = lapDistPct."""
        return self.phase + t / self.pace

    def driver_dict(self) -> dict[str, Any]:
        return {
            "CarIdx": self.idx,
            "UserID": self.user_id,
            "UserName": self.name,
            "TeamName": "",
            "CarNumber": self.number,
            "CarClassID": self.klass["id"],
            "CarClassShortName": self.klass["short"],
            "CarClassColor": self.klass["color"],
            "CarPath": self.klass["short"].lower(),
            "CarScreenName": "Audi R8 LMS EVO II"
            if self.klass is CLASS_GT3
            else "McLaren 570S GT4",
            "IRating": self.irating,
            "LicLevel": self.lic_level,
            "LicSubLevel": self.lic_sub,
            "LicString": self.license_string,
            "LicColor": 0x00FF88,
            "IsSpectator": 0,
            "ClubName": "Iberia",
            "FlairName": self.country_name,
            "FlairShortName": self.country_code,
            "DivisionName": str((self.idx % 5) + 1),
            "CarIsPaceCar": 0,
            "CarIsAI": 1 if self.is_ai else 0,
            "CurDriverIncidentCount": self.idx % 4,
            "TeamID": 0,
        }


class MockField:
    """The whole synthetic field: builds the roster once and animates it."""

    def __init__(self) -> None:
        rng = random.Random(42)  # deterministic field across restarts
        self.cars: list[MockCar] = []
        for idx in range(FIELD_SIZE):
            klass = CLASS_GT3 if (not MULTICLASS or idx % 2 == 0) else CLASS_GT4
            self.cars.append(MockCar(idx, rng, klass))
        self.player = self.cars[0]

    # --- ordering -----------------------------------------------------------
    def _ordered(self, t: float) -> list[MockCar]:
        return sorted(self.cars, key=lambda c: c.progress(t), reverse=True)

    def car_arrays(self, t: float) -> dict[str, Any]:
        n = FIELD_SIZE
        order = self._ordered(t)
        overall_pos = {c.idx: i + 1 for i, c in enumerate(order)}

        # Class positions.
        class_pos: dict[int, int] = {}
        seen: dict[int, int] = {}
        for c in order:
            seen[c.klass["id"]] = seen.get(c.klass["id"], 0) + 1
            class_pos[c.idx] = seen[c.klass["id"]]

        leader = order[0]
        leader_prog = leader.progress(t)

        arr: dict[str, list[Any]] = {
            k: [None] * n
            for k in (
                "CarIdxPosition",
                "CarIdxClassPosition",
                "CarIdxLap",
                "CarIdxLapDistPct",
                "CarIdxLastLapTime",
                "CarIdxBestLapTime",
                "CarIdxEstTime",
                "CarIdxF2Time",
                "CarIdxOnPitRoad",
                "CarIdxTrackSurface",
                "CarIdxTireCompound",
            )
        }
        for c in self.cars:
            prog = c.progress(t)
            lap = int(prog)
            pct = prog - lap
            on_pit = c.pit_at is not None and abs(pct - c.pit_at) < 0.02
            gap = (leader_prog - prog) * c.pace  # seconds behind leader
            arr["CarIdxPosition"][c.idx] = overall_pos[c.idx]
            arr["CarIdxClassPosition"][c.idx] = class_pos[c.idx]
            arr["CarIdxLap"][c.idx] = lap
            arr["CarIdxLapDistPct"][c.idx] = round(pct, 4)
            arr["CarIdxLastLapTime"][c.idx] = round(c.lap_time(t), 3)
            arr["CarIdxBestLapTime"][c.idx] = round(c.pace - 0.8, 3)
            arr["CarIdxEstTime"][c.idx] = round(pct * c.pace, 3)
            arr["CarIdxF2Time"][c.idx] = round(max(0.0, gap), 3)
            arr["CarIdxOnPitRoad"][c.idx] = on_pit
            arr["CarIdxTrackSurface"][c.idx] = 1 if on_pit else 3
            # Alternate compound every ~20 laps to exercise the tyre column.
            arr["CarIdxTireCompound"][c.idx] = (lap // 20) % 2
        return arr

    def session_raw(self, t: float, active_state: int, flags: int) -> dict[str, Any]:
        return {
            "weekend_info": {
                "TrackID": 266,
                "TrackDisplayName": "Circuit de Spa-Francorchamps",
                "TrackConfigName": "Grand Prix Pits",
                "TrackLength": "7.00 km",
                "TrackNumTurns": 19,
                "TrackCity": "Stavelot",
                "TrackCountry": "Belgium",
                "Category": "Road",
                "SubSessionID": 987654321,
            },
            "driver_info": {
                "DriverCarIdx": self.player.idx,
                "PaceCarIdx": -1,
                "DriverCarRedLine": 7800,
                "DriverCarEstLapTime": self.player.pace,
                "Drivers": [c.driver_dict() for c in self.cars],
            },
            "sessions": [
                {
                    "SessionNum": 0,
                    "SessionType": "Race",
                    "SessionName": "RACE",
                    "SessionLaps": "unlimited",
                    "SessionTime": f"{RACE_LENGTH:.4f}",
                },
            ],
            # Three sectors, so the standings screen has boundaries to time against.
            "split_time_info": {
                "Sectors": [
                    {"SectorNum": 0, "SectorStartPct": 0.0},
                    {"SectorNum": 1, "SectorStartPct": 0.34},
                    {"SectorNum": 2, "SectorStartPct": 0.71},
                ],
            },
            "session_num": 0,
            "session_state": active_state,
            "session_time_remain": max(0.0, RACE_LENGTH - t),
            "session_laps_remain": 32767,
            "session_flags": flags,
            "air_temp": 22.0,
            "track_temp": round(30.0 + 2.0 * math.sin(t * 0.01), 1),
        }

    def player_frame(self, t: float) -> dict[str, Any]:
        c = self.player
        prog = c.progress(t)
        pct = prog - int(prog)
        throttle = (math.sin(t * 0.8) + 1.0) / 2.0
        braking = max(0.0, math.sin(t * 0.8 + math.pi)) * (1.0 if throttle < 0.3 else 0.0)
        speed_kmh = 80.0 + 160.0 * throttle
        rpm = 4000.0 + 3600.0 * throttle
        steer = 0.6 * math.sin(t * 0.6)
        fuel_pct = max(0.05, 1.0 - (t % (c.pace * 20)) / (c.pace * 20))
        return {
            "sessionTime": round(t, 3),
            "speed": round(speed_kmh / 3.6, 3),
            "speedKmh": round(speed_kmh, 1),
            "rpm": round(rpm),
            "gear": max(1, min(6, int(1 + throttle * 5))),
            "throttle": round(throttle, 3),
            "brake": round(braking, 3),
            "steeringWheelAngle": round(steer, 4),
            "steeringDeg": round(math.degrees(steer), 1),
            "fuelLevel": round(TANK_CAPACITY * fuel_pct, 2),
            "fuelLevelPct": round(fuel_pct, 3),
            "lapCurrentLapTime": round(pct * c.pace, 3),
            "lapBestLapTime": round(c.pace - 0.8, 3),
            "lapLastLapTime": round(c.lap_time(t), 3),
            "lap": int(prog),
            "lapDistPct": round(pct, 4),
            "playerCarPosition": None,  # standings channel is authoritative
            "playerCarClassPosition": None,
            "latAccel": round(9.0 * math.sin(t * 0.6), 2),
            "lonAccel": round(6.0 * (throttle - braking), 2),
            "onPitRoad": False,
            "airTemp": 22.0,
            "trackTemp": round(30.0 + 2.0 * math.sin(t * 0.01), 1),
            "tyres": {
                corner: {
                    "tempL": round(base + 6 * math.sin(t * 0.5 + i) - 4, 1),
                    "tempM": round(base + 6 * math.sin(t * 0.5 + i), 1),
                    "tempR": round(base + 6 * math.sin(t * 0.5 + i) + 3, 1),
                    "pressure": round(165 + 4 * math.sin(t * 0.2 + i), 1),
                }
                for i, (corner, base) in enumerate(
                    (("lf", 85.0), ("rf", 88.0), ("lr", 80.0), ("rr", 82.0))
                )
            },
        }


class MockSource:
    """A :class:`telemetrylab.TelemetrySource` driven by :class:`MockField`."""

    def __init__(self) -> None:
        self.field = MockField()
        self.start = time.monotonic()

    def _elapsed(self) -> float:
        return time.monotonic() - self.start

    def poll_connection(self) -> bool:
        if DISCONNECT_EVERY <= 0:
            return True
        return (self._elapsed() % (DISCONNECT_EVERY * 2)) < DISCONNECT_EVERY

    def read_session_raw(self) -> dict[str, Any] | None:
        t = self._elapsed()
        # Warmup for the first 10s, then racing under green.
        state = 2 if t < 10 else 4
        flags = 0x00000004  # green
        return self.field.session_raw(t, state, flags)

    def read_player_frame(self) -> dict[str, Any] | None:
        return self.field.player_frame(self._elapsed())

    def read_car_arrays(self) -> dict[str, Any]:
        return self.field.car_arrays(self._elapsed())


async def main() -> None:
    service = BridgeService(MockSource())
    async with serve(service.publisher.register, HOST, PORT):
        print(
            f"[mock] WebSocket server on ws://{HOST}:{PORT} "
            f"({FIELD_SIZE} cars, multiclass={MULTICLASS})",
            flush=True,
        )
        if DISCONNECT_EVERY > 0:
            print(f"[mock] simulating disconnects every {DISCONNECT_EVERY}s", flush=True)
        await service.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("[mock] shutting down", flush=True)
