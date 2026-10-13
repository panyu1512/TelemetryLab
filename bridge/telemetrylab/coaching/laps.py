"""Record the player's laps from the telemetry frames, and line them up.

Two jobs, both prerequisites for comparing one lap with another:

1. :class:`LapRecorder` cuts the 60 Hz frame stream into whole laps, line to
   line, and decides whether each one is fit to compare (no pit lane, no
   reset) and fit to be a *reference* (also no off-track, no incident).
2. :func:`resample` puts a lap on a fixed grid of lap distance, so two laps
   line up point for point and every comparison is a subtraction::

       delta[i] = lap.t[i] - reference.t[i]      # time lost by point i

Timing uses the sim's own clock (``sessionTime``), never the wall clock: the
bridge's telemetry loop sleeps on ``asyncio``, so it duplicates and skips
frames. A repeated ``sessionTime`` is dropped and a skipped one is just a wider
gap for the resampler to interpolate across, so neither moves a number.
"""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Any

# irsdk_TrkLoc, as `PlayerTrackSurface` reports it.
_NOT_IN_WORLD = -1
_OFF_TRACK = 0
_IN_PIT_STALL = 1
_APPROACHING_PITS = 2

#: A lap fraction step backwards bigger than this, that is not the line, is a
#: reset or a tow — the lap in flight is abandoned rather than timed.
MAX_BACKWARD_PCT = 0.02
#: A forward jump bigger than this in one frame is a teleport (tow, reset to
#: pits): no car covers a tenth of a lap in a sixtieth of a second.
MAX_FORWARD_PCT = 0.1
#: A recorded lap with a hole in it wider than this (frames lost, the sim
#: paused mid-lap) is incomplete: interpolating across it would invent a line.
MAX_GAP_PCT = 0.03

#: Why a lap was not clean. The first three mean it cannot even be compared;
#: the last two mean it can be compared but never becomes the reference.
INCOMPARABLE = frozenset({"reset", "pit", "incomplete"})
UNCLEAN = frozenset({"off_track", "incident"})


@dataclass(slots=True)
class Sample:
    """One telemetry frame, reduced to what the coach reads."""

    t: float  # seconds since this lap's line crossing (session time before cut)
    pct: float  # lap fraction, 0..1
    speed: float  # km/h
    throttle: float  # 0..1
    brake: float  # 0..1
    gear: int
    traffic: bool = False  # another car close ahead / alongside


@dataclass(slots=True)
class RecordedLap:
    """A whole lap, line to line, with endpoint samples at 0.0 and 1.0."""

    lap: int
    lap_time: float
    samples: list[Sample]
    invalid_reason: str | None = None

    @property
    def comparable(self) -> bool:
        return self.invalid_reason not in INCOMPARABLE

    @property
    def clean(self) -> bool:
        return self.invalid_reason is None


def sample_from_frame(frame: dict[str, Any], traffic: bool = False) -> Sample | None:
    """Build a :class:`Sample` from a telemetry-channel frame, or None if unusable."""
    t = frame.get("sessionTime")
    pct = frame.get("lapDistPct")
    if t is None or pct is None:
        return None
    speed_kmh = frame.get("speedKmh")
    if speed_kmh is None:
        speed = frame.get("speed")
        speed_kmh = None if speed is None else speed * 3.6
    return Sample(
        t=float(t),
        pct=float(pct),
        speed=float(speed_kmh or 0.0),
        throttle=float(frame.get("throttle") or 0.0),
        brake=float(frame.get("brake") or 0.0),
        gear=int(frame.get("gear") or 0),
        traffic=traffic,
    )


def _blend(a: Sample, b: Sample, f: float, t: float, pct: float) -> Sample:
    """A sample ``f`` of the way from ``a`` to ``b``, at time ``t`` and ``pct``."""
    return Sample(
        t=t,
        pct=pct,
        speed=a.speed + (b.speed - a.speed) * f,
        throttle=a.throttle + (b.throttle - a.throttle) * f,
        brake=a.brake + (b.brake - a.brake) * f,
        gear=a.gear if f < 0.5 else b.gear,
        traffic=a.traffic or b.traffic,
    )


@dataclass(slots=True)
class _LapInFlight:
    lap: int
    start_t: float  # session time of the line crossing
    start_incidents: int | None
    samples: list[Sample] = field(default_factory=list)
    reason: str | None = None

    def flag(self, reason: str) -> None:
        """Record why the lap is not clean, keeping the most serious reason."""
        order = ("reset", "pit", "incomplete", "off_track", "incident")
        if self.reason is None or order.index(reason) < order.index(self.reason):
            self.reason = reason


class LapRecorder:
    """Cut a stream of telemetry frames into :class:`RecordedLap` s.

    Only whole laps are produced: recording starts at the first line crossing,
    so the partial lap the bridge joins mid-way through is never timed.
    """

    def __init__(self) -> None:
        self._prev: Sample | None = None
        self._prev_lap: int | None = None
        self._lap: _LapInFlight | None = None

    def reset(self) -> None:
        self._prev = None
        self._prev_lap = None
        self._lap = None

    def add(self, frame: dict[str, Any], traffic: bool = False) -> RecordedLap | None:
        """Feed one frame; returns the lap it completed, if it completed one."""
        s = sample_from_frame(frame, traffic)  # `t` is session time here
        if s is None:
            return None
        prev = self._prev
        lap_no = frame.get("lap")
        if prev is not None and s.t <= prev.t:
            if s.t >= prev.t - 1.0:
                return None  # a repeated frame — the loop outran the sim
            # The clock ran backwards: a new session, or a replay.
            self.reset()
            prev = None
        if prev is None:
            self._prev, self._prev_lap = s, lap_no
            return None

        done: RecordedLap | None = None
        dp = s.pct - prev.pct
        if prev.pct > 0.8 and s.pct < 0.2 and dp < -0.5:
            # The line: interpolate the instant the car crossed it.
            ahead = 1.0 - prev.pct
            f = ahead / (ahead + s.pct) if (ahead + s.pct) > 0 else 0.0
            t_cross = prev.t + (s.t - prev.t) * f
            if self._lap is not None:
                end = _blend(prev, s, f, t_cross - self._lap.start_t, 1.0)
                self._lap.samples.append(end)
                done = self._finish(self._lap, t_cross)
                # iRacing's `Lap` counts laps started, so the lap just finished
                # is the number the previous frame carried.
                if isinstance(self._prev_lap, int):
                    done.lap = self._prev_lap
            started = lap_no if isinstance(lap_no, int) else (done.lap + 1 if done else 0)
            self._lap = _LapInFlight(
                lap=started,
                start_t=t_cross,
                start_incidents=frame.get("incidentCount"),
                samples=[_blend(prev, s, f, 0.0, 0.0)],
            )
        elif self._lap is not None and (dp < -MAX_BACKWARD_PCT or dp > MAX_FORWARD_PCT):
            self._lap.flag("reset")

        if self._lap is not None:
            self._apply_flags(self._lap, frame)
            self._lap.samples.append(replace(s, t=s.t - self._lap.start_t))
        self._prev, self._prev_lap = s, lap_no
        return done

    @staticmethod
    def _apply_flags(lap: _LapInFlight, frame: dict[str, Any]) -> None:
        surface = frame.get("trackSurface")
        if frame.get("onPitRoad") or surface in (_IN_PIT_STALL, _APPROACHING_PITS):
            lap.flag("pit")
        elif surface == _NOT_IN_WORLD:
            lap.flag("reset")
        elif surface == _OFF_TRACK:
            lap.flag("off_track")
        incidents = frame.get("incidentCount")
        if (
            isinstance(incidents, int)
            and isinstance(lap.start_incidents, int)
            and incidents > lap.start_incidents
        ):
            lap.flag("incident")

    @staticmethod
    def _finish(lap: _LapInFlight, t_cross: float) -> RecordedLap:
        lap_time = t_cross - lap.start_t
        samples = sorted(lap.samples, key=lambda x: (x.pct, x.t))
        if lap_time <= 0 or len(samples) < 2:
            lap.flag("incomplete")
        else:
            widest = max(b.pct - a.pct for a, b in zip(samples, samples[1:], strict=False))
            if widest > MAX_GAP_PCT:
                lap.flag("incomplete")
        return RecordedLap(
            lap=lap.lap, lap_time=lap_time, samples=samples, invalid_reason=lap.reason
        )


# ---------------------------------------------------------------------------
# Resampling onto a distance grid
# ---------------------------------------------------------------------------

#: Grid spacing, metres. At 250 km/h a 60 Hz frame is ~1.2 m apart, so 2 m
#: keeps a braking point honest to a metre or two without inventing detail.
GRID_STEP_M = 2.0
MIN_POINTS = 201
MAX_POINTS = 5001
#: Used when the track length is unknown — a mid-length road course.
DEFAULT_POINTS = 2001


def grid_points(track_length_m: float | None) -> int:
    """How many grid points (both ends included) for a track of this length."""
    if not track_length_m or track_length_m <= 0:
        return DEFAULT_POINTS
    n = int(round(track_length_m / GRID_STEP_M)) + 1
    return max(MIN_POINTS, min(MAX_POINTS, n))


@dataclass(slots=True)
class ResampledLap:
    """A lap on a fixed distance grid: point ``i`` sits at ``i / (n - 1)``.

    Point ``0`` is the line at the start and point ``n - 1`` the line at the
    end, so ``t[-1]`` is the lap time. Every list has ``n`` entries.
    """

    lap: int
    lap_time: float
    invalid_reason: str | None
    t: list[float]
    speed: list[float]
    throttle: list[float]
    brake: list[float]
    gear: list[int]
    traffic: list[bool]

    @property
    def n(self) -> int:
        return len(self.t)

    @property
    def clean(self) -> bool:
        return self.invalid_reason is None


def resample(lap: RecordedLap, points: int) -> ResampledLap:
    """Interpolate ``lap`` onto ``points`` evenly spaced lap fractions."""
    # Strictly increasing pct: drop any sample that does not move forward (a
    # car stationary on the grid, a frame that jittered back a hair).
    src: list[Sample] = []
    for s in lap.samples:
        if not src or s.pct > src[-1].pct:
            src.append(s)
    if len(src) < 2:
        raise ValueError("a lap needs at least two distinct points to resample")

    t: list[float] = []
    speed: list[float] = []
    throttle: list[float] = []
    brake: list[float] = []
    gear: list[int] = []
    traffic: list[bool] = []
    j = 0
    last = points - 1
    for i in range(points):
        p = i / last
        while j < len(src) - 2 and src[j + 1].pct < p:
            j += 1
        a, b = src[j], src[j + 1]
        span = b.pct - a.pct
        f = 0.0 if span <= 0 else max(0.0, min(1.0, (p - a.pct) / span))
        t.append(a.t + (b.t - a.t) * f)
        speed.append(a.speed + (b.speed - a.speed) * f)
        throttle.append(a.throttle + (b.throttle - a.throttle) * f)
        brake.append(a.brake + (b.brake - a.brake) * f)
        gear.append(a.gear if f < 0.5 else b.gear)
        traffic.append(a.traffic if f < 0.5 else b.traffic)
    # The endpoints are the line by definition.
    t[0] = 0.0
    t[-1] = lap.lap_time
    return ResampledLap(
        lap=lap.lap,
        lap_time=lap.lap_time,
        invalid_reason=lap.invalid_reason,
        t=t,
        speed=speed,
        throttle=throttle,
        brake=brake,
        gear=gear,
        traffic=traffic,
    )
