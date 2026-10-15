"""Time everybody's laps, and hold the player's against the fastest one.

The coach's reference is the player's own quickest clean lap, measured with
pedals and speeds, because that is the only car iRacing gives inputs for. For
every other car it publishes where the car is on the lap
(``CarIdxLapDistPct``) — and on the sim's clock that is enough to *time* a
lap anywhere along it: the instant a car passed a point is an interpolation
between the two frames either side.

:class:`FieldLapTimer` does that for every car at once, on a fixed grid of lap
fractions, so a whole lap comes out as "seconds since the line" at every point
round the track (:class:`TimedLap`). The fastest clean one in the player's
class is the **session best**, and :func:`compare_to_best` holds the player's
lap against it corner by corner — on the coach's own corner segments, so the
gaps add up to the lap-time difference exactly as the coach's do. What it can
say is *how much* time each corner cost against the quickest car out there;
*why* is the coach's job, against a lap it has the inputs for.

Clean, for a lap the bridge cannot see the pedals of, means: timed line to
line, never off the racing surface, never on pit road, never jumping along the
lap (a tow or reset). iRacing does not publish other drivers' incidents, so an
off-track that kept two wheels on the surface still counts — the same blind
spot the sim's own fastest-lap readout has.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from .corners import Corner
from .laps import MAX_BACKWARD_PCT, MAX_FORWARD_PCT, ResampledLap

#: Grid points per lap (plus the line at the end). 0.1 % of a lap is 7 m at
#: Spa — finer than any corner boundary needs, and a car crosses about one
#: point a frame.
FIELD_POINTS = 1000

#: ``CarIdxTrackSurface`` (irsdk_TrkLoc) values a clean lap stays on: only on
#: track. Off track (0), the pit stall (1), approaching the pits (2) and not
#: in the world (-1) all spoil it.
_ON_TRACK = 3


@dataclass(slots=True)
class TimedLap:
    """A whole lap as the time since the line at evenly spaced lap fractions.

    ``t[i]`` sits at ``i / (len(t) - 1)``, so ``t[0]`` is ``0.0`` and ``t[-1]``
    the lap time. A field lap and one of the coach's resampled laps both fit.
    """

    car_idx: int | None
    lap: int | None
    lap_time: float
    t: list[float]
    #: The player's own lap (from the coach), not one timed off the field.
    is_player: bool = False

    def time_at(self, pct: float) -> float:
        """Seconds since the line when the car was at lap fraction ``pct``."""
        last = len(self.t) - 1
        x = max(0.0, min(1.0, pct)) * last
        i = min(int(x), last - 1)
        f = x - i
        return self.t[i] + (self.t[i + 1] - self.t[i]) * f

    def ref(self) -> dict[str, Any]:
        """The wire shape naming this lap (`SessionBestRef` in TS)."""
        return {
            "carIdx": self.car_idx,
            "lap": self.lap,
            "lapTime": round(self.lap_time, 3),
            "isPlayer": self.is_player,
        }


@dataclass(slots=True)
class _InFlight:
    lap: int | None
    start_t: float
    t: list[float]
    clean: bool = True


def _num(arr: Any, idx: int) -> float | None:
    if arr is None:
        return None
    try:
        v = arr[idx]
    except (IndexError, TypeError, KeyError):
        return None
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    return float(v)


def _flag(arr: Any, idx: int) -> bool:
    if arr is None:
        return False
    try:
        return bool(arr[idx])
    except (IndexError, TypeError, KeyError):
        return False


class FieldLapTimer:
    """Times every car's laps from ``CarIdxLapDistPct`` on the session clock.

    Like the coach's recorder it only produces whole laps: a car's first timed
    lap starts at the first line crossing the timer sees.
    """

    def __init__(self, points: int = FIELD_POINTS) -> None:
        self._points = points
        self._last_t: float | None = None
        self._prev: dict[int, tuple[float, float]] = {}
        self._laps: dict[int, _InFlight] = {}

    def reset(self) -> None:
        self._last_t = None
        self._prev = {}
        self._laps = {}

    def feed(
        self, session_time: Any, arrays: dict[str, Any], cars: Iterable[int]
    ) -> list[TimedLap]:
        """Feed one frame of the ``CarIdx*`` arrays; returns the clean laps it completed.

        ``cars`` are the car indices to time (the caller decides who is worth
        comparing with — the player's class, without the pace car).
        """
        if isinstance(session_time, bool) or not isinstance(session_time, (int, float)):
            return []
        t = float(session_time)
        if self._last_t is not None and t <= self._last_t:
            if t >= self._last_t - 1.0:
                return []  # a repeated frame: the loop outran the sim
            self.reset()  # the clock ran backwards: a new session, or a replay
        self._last_t = t

        pct_arr = arrays.get("CarIdxLapDistPct")
        surf_arr = arrays.get("CarIdxTrackSurface")
        pit_arr = arrays.get("CarIdxOnPitRoad")
        lap_arr = arrays.get("CarIdxLap")
        done: list[TimedLap] = []
        wanted = set(cars)
        for idx in list(self._prev):
            if idx not in wanted:
                self._prev.pop(idx, None)
                self._laps.pop(idx, None)
        for idx in wanted:
            pct = _num(pct_arr, idx)
            if pct is None or pct < 0:
                # Not in the world: whatever lap it was on is over, untimed.
                self._prev.pop(idx, None)
                self._laps.pop(idx, None)
                continue
            lap_no = _num(lap_arr, idx)
            finished = self._step(idx, t, pct, None if lap_no is None else int(lap_no))
            if finished is not None:
                done.append(finished)
            lap = self._laps.get(idx)
            if lap is not None:
                surface = _num(surf_arr, idx)
                if _flag(pit_arr, idx) or (surface is not None and surface != _ON_TRACK):
                    lap.clean = False
        return done

    # --- one car, one frame ----------------------------------------------------
    def _step(self, idx: int, t: float, pct: float, lap_no: int | None) -> TimedLap | None:
        prev = self._prev.get(idx)
        self._prev[idx] = (t, pct)
        if prev is None:
            return None
        pt, pp = prev
        lap = self._laps.get(idx)
        dp = pct - pp
        if pp > 0.8 and pct < 0.2 and dp < -0.5:
            # The line: interpolate the instant the car crossed it.
            ahead = 1.0 - pp
            f = ahead / (ahead + pct) if (ahead + pct) > 0 else 0.0
            t_cross = pt + (t - pt) * f
            done = None
            if lap is not None:
                self._fill(lap, pt, pp, t_cross, 1.0)
                done = self._finish(idx, lap, t_cross)
            started = (
                lap_no
                if lap_no is not None
                else (lap.lap + 1 if lap is not None and lap.lap is not None else None)
            )
            new = _InFlight(lap=started, start_t=t_cross, t=[0.0])
            self._laps[idx] = new
            self._fill(new, t_cross, 0.0, t, pct)
            return done
        if lap is None:
            return None
        if dp < -MAX_BACKWARD_PCT or dp > MAX_FORWARD_PCT:
            lap.clean = False  # a reset or a tow: this lap is not a lap
        elif dp > 0:
            self._fill(lap, pt, pp, t, pct)
        return None

    def _fill(self, lap: _InFlight, t0: float, p0: float, t1: float, p1: float) -> None:
        """Time every grid point in ``(p0, p1]`` by interpolating the two frames."""
        span = p1 - p0
        k = len(lap.t)
        while k <= self._points:
            p = k / self._points
            if p > p1 + 1e-12:
                break
            if p < p0 - 1e-12:
                # A point before this stretch was never crossed: a hole.
                lap.clean = False
            f = 0.0 if span <= 0 else max(0.0, min(1.0, (p - p0) / span))
            lap.t.append(t0 + (t1 - t0) * f - lap.start_t)
            k += 1

    def _finish(self, idx: int, lap: _InFlight, t_cross: float) -> TimedLap | None:
        lap_time = t_cross - lap.start_t
        if not lap.clean or lap_time <= 0 or len(lap.t) != self._points + 1:
            return None
        lap.t[-1] = lap_time
        return TimedLap(car_idx=idx, lap=lap.lap, lap_time=lap_time, t=lap.t)


def timed_from_resampled(lap: ResampledLap, car_idx: int | None) -> TimedLap:
    """The player's own lap, as the coach resampled it, in the session-best shape."""
    return TimedLap(
        car_idx=car_idx, lap=lap.lap, lap_time=lap.lap_time, t=list(lap.t), is_player=True
    )


@dataclass(slots=True)
class BestGap:
    """One corner of the player's lap against the session best."""

    corner: int  # Corner.number
    time_lost: float  # + lost to the session best, − gained on it

    def to_dict(self) -> dict[str, Any]:
        return {"corner": self.corner, "timeLost": round(self.time_lost, 3)}


def compare_to_best(lap: ResampledLap, best: TimedLap, corners: list[Corner]) -> list[BestGap]:
    """The player's lap against ``best``, on the coach's corner segments.

    Segments run from one corner's start to the next's and wrap over the line,
    as in :func:`telemetrylab.coaching.compare.segment_loss`, so the gaps add
    up to the lap-time difference.
    """
    if not corners:
        return []
    last = lap.n - 1

    def delta(i: int) -> float:
        return lap.t[i] - best.time_at(i / last)

    out = []
    for k, corner in enumerate(corners):
        start = corner.start
        end = corners[(k + 1) % len(corners)].start
        if start == end:
            loss = delta(last)  # the whole lap: a track with a single corner
        elif start < end:
            loss = delta(end) - delta(start)
        else:
            loss = (delta(last) - delta(start)) + (delta(end) - delta(0))
        out.append(BestGap(corner=corner.number, time_lost=loss))
    return out
