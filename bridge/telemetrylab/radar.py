"""The car radar: who is alongside you, on which side, and how far up.

iRacing has a spotter of its own, ``CarLeftRight``, and it is the authority on
*whether* a car is alongside: it is computed by the sim from the real car
geometry. What it does not say is *which* car, or how far along you it is — only
"car left", "two cars right" and so on. On a single screen that is the whole
problem: the car is in your blind spot and the spotter's voice is all you get.

This module puts the call on a map. Every car's ``CarIdxLapDistPct`` gives its
distance along the lap, so the gap to the player in metres is exact along the
track. The spotter's counts then say how many of the nearest cars are alongside
and on which side. What the sim never publishes is the **lateral** distance
between two cars, so a car alongside is placed one lane over (or two, when the
spotter calls two cars on that side) — the one assumption here, and the frontend
says so where it draws the angle.

Assigning sides is the only part with memory. "Car left and right" with two cars
alongside does not say which is which; :class:`RadarTracker` remembers the side
each car was given while it stays alongside, so the car that came up your left
stays on your left when a second one arrives on the right.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .enums import CAR_LEFT_RIGHT_COUNTS, car_left_right

#: How far ahead and behind the radar looks, in metres along the track.
RANGE_M = 30.0

#: The furthest a car can be from the player along the track and still be the
#: one the spotter is calling alongside. A car overlaps when the gap is under a
#: car length (~5 m); the slack covers lap distance being measured on the
#: track's centre line, which an inside and an outside car only approximate.
ALONGSIDE_M = 8.0

#: Track surfaces a car can be beside you on: off track, approaching the pits
#: and on track. Not in world (-1) and in the pit stall (1) are never alongside.
_ON_TRACK_SURFACES = frozenset({0, 2, 3})


@dataclass(slots=True)
class RadarCar:
    """One car within range of the player."""

    car_idx: int
    gap_m: float  # along the track, signed: positive = ahead of the player
    side: str | None  # "left" | "right" when alongside, else None (unknown)
    lane: int | None  # 1 = next to you, 2 = beyond that car; None when not alongside

    def to_dict(self) -> dict[str, Any]:
        return {
            "carIdx": self.car_idx,
            "gapM": self.gap_m,
            "side": self.side,
            "lane": self.lane,
        }


@dataclass(slots=True)
class RadarFrame:
    """The radar's reading for one telemetry frame."""

    state: str  # car_left_right() label, e.g. "car_left"
    car_left_right: int | None  # raw CarLeftRight
    left: int  # cars alongside on the left, per the spotter (0..2)
    right: int  # cars alongside on the right, per the spotter (0..2)
    range_m: float
    cars: list[RadarCar] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "state": self.state,
            "carLeftRight": self.car_left_right,
            "left": self.left,
            "right": self.right,
            "rangeM": self.range_m,
            "cars": [c.to_dict() for c in self.cars],
        }


def _at(arr: Any, idx: int) -> Any:
    if arr is None:
        return None
    try:
        return arr[idx]
    except (IndexError, TypeError, KeyError):
        return None


def _pct(value: Any) -> float | None:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return None
    return float(value) if value >= 0 else None


def wrap_gap(pct: float, player_pct: float) -> float:
    """Lap-fraction gap from the player to a car, wrapped to [-0.5, 0.5).

    Two cars either side of the start/finish line are a few metres apart, not
    a lap.
    """
    d = (pct - player_pct) % 1.0
    return d - 1.0 if d >= 0.5 else d


def nearby_cars(
    arrays: dict[str, Any],
    player_car_idx: int,
    track_length_m: float,
    range_m: float = RANGE_M,
) -> list[tuple[int, float]]:
    """``(car_idx, gap_m)`` for every car within ``range_m``, nearest first."""
    pct_arr = arrays.get("CarIdxLapDistPct")
    surf_arr = arrays.get("CarIdxTrackSurface")
    pit_arr = arrays.get("CarIdxOnPitRoad")
    player_pct = _pct(_at(pct_arr, player_car_idx))
    if pct_arr is None or player_pct is None or track_length_m <= 0:
        return []

    out: list[tuple[int, float]] = []
    for idx in range(len(pct_arr)):
        if idx == player_car_idx:
            continue
        pct = _pct(_at(pct_arr, idx))
        if pct is None:
            continue
        surface = _at(surf_arr, idx)
        if surface is not None and surface not in _ON_TRACK_SURFACES:
            continue
        if _at(pit_arr, idx):
            continue
        gap_m = wrap_gap(pct, player_pct) * track_length_m
        if abs(gap_m) <= range_m:
            out.append((idx, gap_m))
    out.sort(key=lambda c: (abs(c[1]), c[0]))
    return out


class RadarTracker:
    """Turns the spotter's counts and the cars' lap distances into a map.

    Stateful only in the sides it has handed out: see the module docstring.
    """

    def __init__(self) -> None:
        # car_idx → (side, lane) for the cars alongside last frame.
        self._placed: dict[int, tuple[str, int]] = {}

    def reset(self) -> None:
        self._placed = {}

    def update(
        self,
        car_left_right_raw: Any,
        arrays: dict[str, Any],
        player_car_idx: int,
        track_length_m: float | None,
    ) -> RadarFrame:
        raw = int(car_left_right_raw) if isinstance(car_left_right_raw, (int, float)) else None
        state = car_left_right(raw)
        n_left, n_right = CAR_LEFT_RIGHT_COUNTS.get(raw, (0, 0)) if raw is not None else (0, 0)
        frame = RadarFrame(
            state=state, car_left_right=raw, left=n_left, right=n_right, range_m=RANGE_M
        )

        # "off": the player is not driving (garage, replay, spectating). The
        # spotter has nothing to say and neither does the radar.
        if state == "off" or not track_length_m:
            self._placed = {}
            return frame

        near = nearby_cars(arrays, player_car_idx, track_length_m)
        wanted = n_left + n_right
        alongside = [c for c in near if abs(c[1]) <= ALONGSIDE_M][:wanted]
        placed = self._place([idx for idx, _ in alongside], n_left, n_right)
        self._placed = placed

        frame.cars = [
            RadarCar(
                car_idx=idx,
                gap_m=round(gap, 2),
                side=placed[idx][0] if idx in placed else None,
                lane=placed[idx][1] if idx in placed else None,
            )
            for idx, gap in near
        ]
        return frame

    def _place(self, cars: list[int], n_left: int, n_right: int) -> dict[int, tuple[str, int]]:
        """Give each alongside car a side and a lane, keeping last frame's."""
        free = {"left": n_left, "right": n_right}
        sides: dict[int, str] = {}
        # Cars already alongside keep their side while the spotter still has
        # room for them there...
        for idx in cars:
            prev = self._placed.get(idx)
            if prev is not None and free[prev[0]] > 0:
                sides[idx] = prev[0]
                free[prev[0]] -= 1
        # ...and new arrivals (nearest first) take what is left, left first.
        for idx in cars:
            if idx in sides:
                continue
            side = "left" if free["left"] > 0 else "right" if free["right"] > 0 else None
            if side is None:
                break
            sides[idx] = side
            free[side] -= 1

        # Lanes: a car that was next to you stays next to you; a second car on
        # the same side goes beyond it.
        out: dict[int, tuple[str, int]] = {}
        for side in ("left", "right"):
            on_side = [i for i in cars if sides.get(i) == side]
            on_side.sort(key=lambda i, side=side: self._lane_before(i, side))
            for lane, idx in enumerate(on_side, start=1):
                out[idx] = (side, lane)
        return out

    def _lane_before(self, idx: int, side: str) -> int:
        """The lane a car had on ``side`` last frame; new arrivals sort last."""
        prev = self._placed.get(idx)
        return prev[1] if prev is not None and prev[0] == side else 3
