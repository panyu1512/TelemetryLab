"""Ingest the ``CarIdx*`` telemetry arrays into per-car timing.

iRacing publishes most multi-car data as arrays indexed by ``CarIdx``. We read
them once per standings tick and fan them out into one :class:`CarTiming` per
active car. This module is deliberately source-agnostic: it takes a plain dict
of arrays, so the real bridge (irsdk) and the mock feed it identically.
"""

from __future__ import annotations

from typing import Any, Iterable, Optional

from .enums import track_surface
from .models import CarTiming

#: The CarIdx arrays we read. Kept in one place so the bridge can request
#: exactly these from the SDK and the mock knows what to synthesize.
CAR_IDX_VARS = (
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
)


def _at(arr: Any, idx: int) -> Any:
    """Safe indexed read from a possibly-short/None array."""
    if arr is None:
        return None
    try:
        return arr[idx]
    except (IndexError, TypeError, KeyError):
        return None


def _pos(value: Any) -> Optional[int]:
    """Position 0 means 'no position yet' in iRacing → normalize to None."""
    v = _at_int(value)
    return v if v and v > 0 else None


def _at_int(value: Any) -> Optional[int]:
    return int(value) if isinstance(value, (int, float)) else None


def _at_float(value: Any) -> Optional[float]:
    if not isinstance(value, (int, float)):
        return None
    # iRacing uses -1 as "no valid time" for lap-time-ish arrays.
    return None if value < 0 else float(value)


def _wrap_delta(delta: float, lap_time: Optional[float]) -> float:
    """Wrap a raw est-time difference to the shortest way round the lap.

    Relative gaps are only meaningful within ±half a lap; beyond that the car is
    better described as N laps up/down (handled by the standings layer).
    """
    if not lap_time or lap_time <= 0:
        return delta
    half = lap_time / 2.0
    while delta > half:
        delta -= lap_time
    while delta < -half:
        delta += lap_time
    return delta


def ingest_car_timings(
    arrays: dict[str, Any],
    *,
    timestamp: int,
    player_car_idx: int,
    est_lap_time: Optional[float],
    include: Iterable[int],
) -> dict[int, CarTiming]:
    """Build ``{car_idx: CarTiming}`` for every car in ``include``.

    ``include`` is normally the set of roster car indices (so we don't emit 60
    empty grid slots), but any index with live track presence can be added by
    the caller. ``player_car_idx`` + ``est_lap_time`` drive the relative
    ``delta_to_player`` computation.
    """
    surf_arr = arrays.get("CarIdxTrackSurface")
    est_arr = arrays.get("CarIdxEstTime")

    player_est = _at_float(_at(est_arr, player_car_idx))

    out: dict[int, CarTiming] = {}
    for idx in include:
        surface = _at_int(_at(surf_arr, idx))
        car_est = _at_float(_at(est_arr, idx))

        delta: Optional[float] = None
        if player_est is not None and car_est is not None and idx != player_car_idx:
            delta = _wrap_delta(car_est - player_est, est_lap_time)
        elif idx == player_car_idx:
            delta = 0.0

        out[idx] = CarTiming(
            car_idx=idx,
            position=_pos(_at(arrays.get("CarIdxPosition"), idx)),
            class_position=_pos(_at(arrays.get("CarIdxClassPosition"), idx)),
            lap=_at_int(_at(arrays.get("CarIdxLap"), idx)),
            lap_dist_pct=_at_float(_at(arrays.get("CarIdxLapDistPct"), idx)),
            last_lap_time=_at_float(_at(arrays.get("CarIdxLastLapTime"), idx)),
            best_lap_time=_at_float(_at(arrays.get("CarIdxBestLapTime"), idx)),
            estimated_lap_time=car_est,
            f2_time=_at_float(_at(arrays.get("CarIdxF2Time"), idx)),
            delta_to_player=delta,
            on_pit_road=bool(_at(arrays.get("CarIdxOnPitRoad"), idx))
            if _at(arrays.get("CarIdxOnPitRoad"), idx) is not None else None,
            track_surface=surface,
            track_surface_label=track_surface(surface),
            timestamp=timestamp,
        )
    return out
