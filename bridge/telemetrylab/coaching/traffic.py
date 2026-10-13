"""Was another car in the way? — so the coach does not blame the driver for it.

A corner driven behind a slower car, or side by side, loses time that no
braking point would have saved. The coach tags every sample with whether a car
was close ahead or alongside, and a corner touched by traffic is reported as
``traffic`` instead of being given a driving cause.

Positions come from the standings channel's last ``CarIdxLapDistPct`` read
(~10 Hz), not the 60 Hz frame: comparing the player against cars from the same
read keeps both sides equally stale, which matters more than freshness at the
few-metre scale this works at.
"""

from __future__ import annotations

from collections.abc import Mapping

from ..models import CarTiming

#: A car this far ahead or closer is holding you up …
AHEAD_M = 40.0
#: … and one this close behind is alongside, or diving down the inside.
BEHIND_M = 8.0
_ON_TRACK = 3


def traffic_near(
    player_idx: int, timings: Mapping[int, CarTiming], track_length_m: float | None
) -> bool:
    """True when any other car on track is within the traffic window."""
    me = timings.get(player_idx)
    if me is None or me.lap_dist_pct is None or not track_length_m or track_length_m <= 0:
        return False
    for idx, car in timings.items():
        if idx == player_idx or car.lap_dist_pct is None:
            continue
        if car.on_pit_road or car.track_surface != _ON_TRACK:
            continue
        # Signed gap round the lap, folded into ±half a lap.
        gap_pct = (car.lap_dist_pct - me.lap_dist_pct + 0.5) % 1.0 - 0.5
        gap_m = gap_pct * track_length_m
        if -BEHIND_M <= gap_m <= AHEAD_M:
            return True
    return False
