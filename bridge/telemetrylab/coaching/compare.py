"""Compare a lap with the reference, corner by corner, and name the cause.

Both laps are on the same distance grid, so time lost anywhere is a
subtraction (:func:`time_delta`), and time lost in a corner's segment is the
change in that delta across it. Segments partition the lap, so the per-corner
losses always add up to the lap-time difference.

The *why* comes from fixed rules over a handful of measurements — braking
point, entry, minimum and exit speed, throttle pick-up, coasting — not from a
model. A rule set is predictable, testable against laps with known mistakes
(:mod:`telemetrylab.mocktrack`), and says the same thing about the same lap
every time, which is what a driver needs before they trust it.

Signs are always "you minus reference", read from the driver's side:

- ``time_lost``     + lost time, − gained it
- ``brake_delta_m`` + braked *earlier* (further from the apex)
- ``*_speed_delta`` + faster
- ``throttle_delta_m`` + back on the throttle *later*
- ``coast_delta_m`` + more distance rolled off both pedals
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .corners import Corner, Ring
from .laps import ResampledLap

#: Brake pedal at or above this is "on the brakes" for the braking point.
BRAKE_ON = 0.1
#: Throttle at or above this, after the apex, is "back on the power".
THROTTLE_ON = 0.9
#: Both pedals at or below this is coasting.
COAST_BELOW = 0.05
#: How far past a corner's exit to look for the throttle pick-up.
PICKUP_REACH_M = 150.0
#: Traffic this close before the corner's start still counts against it.
TRAFFIC_LEAD_M = 50.0

#: A corner within this of the reference is "even" — measurement noise, not
#: driving. The overlay applies its own (larger, user-set) threshold for tips.
EVEN_S = 0.02

# Cause thresholds. Each is the smallest difference a driver could act on.
EARLY_BRAKE_M = 8.0
LATE_BRAKE_M = 6.0
COAST_M = 15.0
ENTRY_FAST_KMH = 3.0
APEX_SLOW_KMH = 3.0
LATE_THROTTLE_M = 10.0
EXIT_SLOW_KMH = 3.0

#: Every cause the coach can name, in the order the rules test them.
CAUSES = (
    "gain",
    "even",
    "traffic",
    "early_brake",
    "coasting",
    "overdrove",
    "over_slowed",
    "late_throttle",
    "slow_exit",
    "line",
)
#: Causes that blame the driver — the ones a tally of repeats is kept for.
DRIVER_CAUSES = frozenset(CAUSES[3:])


@dataclass(slots=True)
class CornerAnalysis:
    corner: int  # Corner.number
    time_lost: float
    cause: str
    brake_delta_m: float | None
    entry_speed_delta_kmh: float | None
    min_speed_delta_kmh: float | None
    exit_speed_delta_kmh: float | None
    throttle_delta_m: float | None
    coast_delta_m: float | None
    traffic: bool
    repeat: int = 0
    repeat_window: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "corner": self.corner,
            "timeLost": round(self.time_lost, 3),
            "cause": self.cause,
            "brakeDeltaM": _r(self.brake_delta_m, 1),
            "entrySpeedDeltaKmh": _r(self.entry_speed_delta_kmh, 1),
            "minSpeedDeltaKmh": _r(self.min_speed_delta_kmh, 1),
            "exitSpeedDeltaKmh": _r(self.exit_speed_delta_kmh, 1),
            "throttleDeltaM": _r(self.throttle_delta_m, 1),
            "coastDeltaM": _r(self.coast_delta_m, 1),
            "traffic": self.traffic,
            "repeat": self.repeat,
            "repeatWindow": self.repeat_window,
        }


def _r(x: float | None, digits: int) -> float | None:
    return None if x is None else round(x, digits)


def time_delta(lap: ResampledLap, ref: ResampledLap) -> list[float]:
    """Cumulative time lost by each grid point (``lap - ref``)."""
    return [a - b for a, b in zip(lap.t, ref.t, strict=True)]


def segment_loss(delta: list[float], start: int, end: int, ring: Ring) -> float:
    """Time lost from ``start`` forward to ``end`` (exclusive), across the line."""
    if start == end:
        return delta[-1]  # the whole lap: a track with a single corner
    if start < end:
        return delta[end] - delta[start]
    # Wraps the line: the tail of this lap plus its own opening metres. Same
    # stretch of road, timed at both ends of one lap.
    return (delta[ring.m] - delta[start]) + (delta[end] - delta[0])


# --- measurements -----------------------------------------------------------


def _brake_point(lap: ResampledLap, corner: Corner, ring: Ring) -> int | None:
    for i in ring.span(corner.start, corner.apex):
        if lap.brake[i] >= BRAKE_ON:
            return i
    return None


def _pickup(lap: ResampledLap, corner: Corner, ring: Ring) -> int | None:
    end = ring.wrap(corner.exit + ring.points(PICKUP_REACH_M))
    for i in ring.span(corner.apex, end):
        if lap.throttle[i] >= THROTTLE_ON and lap.brake[i] < BRAKE_ON:
            return i
    return None


def _coast_m(lap: ResampledLap, corner: Corner, ring: Ring) -> float:
    n = sum(
        1
        for i in ring.span(corner.start, corner.exit)
        if lap.throttle[i] <= COAST_BELOW and lap.brake[i] <= COAST_BELOW
    )
    return n * ring.step_m


def compare_corner(
    lap: ResampledLap,
    ref: ResampledLap,
    corner: Corner,
    next_start: int,
    delta: list[float],
    ring: Ring,
) -> CornerAnalysis:
    """Measure ``lap`` against ``ref`` through one corner and name the cause."""
    loss = segment_loss(delta, corner.start, next_start, ring)
    zone = ring.span(corner.entry, corner.exit)

    lap_bp, ref_bp = _brake_point(lap, corner, ring), _brake_point(ref, corner, ring)
    brake_delta = None
    if lap_bp is not None and ref_bp is not None:
        # Distance before the apex: more = earlier.
        brake_delta = (ring.ahead(lap_bp, corner.apex) - ring.ahead(ref_bp, corner.apex)) * (
            ring.step_m
        )

    # Entry speed: half-way from the reference's braking point to the apex —
    # slower there if you braked early, faster if you braked late.
    probe = (
        ring.wrap(ref_bp + ring.ahead(ref_bp, corner.apex) // 2)
        if ref_bp is not None
        else corner.entry
    )
    entry_delta = lap.speed[probe] - ref.speed[probe]
    min_delta = min(lap.speed[i] for i in zone) - min(ref.speed[i] for i in zone)
    exit_delta = lap.speed[corner.exit] - ref.speed[corner.exit]

    lap_up, ref_up = _pickup(lap, corner, ring), _pickup(ref, corner, ring)
    throttle_delta = None
    if lap_up is not None and ref_up is not None:
        throttle_delta = (
            ring.ahead(corner.apex, lap_up) - ring.ahead(corner.apex, ref_up)
        ) * ring.step_m

    coast_delta = _coast_m(lap, corner, ring) - _coast_m(ref, corner, ring)
    lead = ring.wrap(corner.start - ring.points(TRAFFIC_LEAD_M))
    traffic = any(lap.traffic[i] for i in ring.span(lead, corner.exit))

    analysis = CornerAnalysis(
        corner=corner.number,
        time_lost=loss,
        cause="line",
        brake_delta_m=brake_delta,
        entry_speed_delta_kmh=entry_delta,
        min_speed_delta_kmh=min_delta,
        exit_speed_delta_kmh=exit_delta,
        throttle_delta_m=throttle_delta,
        coast_delta_m=coast_delta,
        traffic=traffic,
    )
    analysis.cause = classify(analysis)
    return analysis


def classify(a: CornerAnalysis) -> str:
    """The rule set. First match wins; the order is the order of blame.

    Braking early outranks a slow apex because it *causes* one in the speed
    trace, and the brake point is what the driver moves. A slow apex outranks
    a late pick-up for the same reason: you cannot get back on the power
    early from a corner you have already over-slowed.
    """
    if a.time_lost <= -EVEN_S:
        return "gain"
    if a.time_lost < EVEN_S:
        return "even"
    if a.traffic:
        return "traffic"
    brake = a.brake_delta_m
    apex = a.min_speed_delta_kmh or 0.0
    if brake is not None and brake >= EARLY_BRAKE_M:
        return "early_brake"
    if (a.coast_delta_m or 0.0) >= COAST_M:
        return "coasting"
    entry = a.entry_speed_delta_kmh or 0.0
    late = brake is not None and brake <= -LATE_BRAKE_M
    if (entry >= ENTRY_FAST_KMH or late) and apex <= -APEX_SLOW_KMH:
        return "overdrove"
    if apex <= -APEX_SLOW_KMH:
        return "over_slowed"
    if (a.throttle_delta_m or 0.0) >= LATE_THROTTLE_M:
        return "late_throttle"
    if (a.exit_speed_delta_kmh or 0.0) <= -EXIT_SLOW_KMH:
        return "slow_exit"
    return "line"


def compare_lap(
    lap: ResampledLap, ref: ResampledLap, corners: list[Corner], ring: Ring
) -> list[CornerAnalysis]:
    """Every corner of ``lap`` against ``ref``. Losses sum to the lap delta."""
    if lap.n != ref.n:
        raise ValueError("laps must share a grid to be compared")
    delta = time_delta(lap, ref)
    out = []
    for k, corner in enumerate(corners):
        nxt = corners[(k + 1) % len(corners)].start
        out.append(compare_corner(lap, ref, corner, nxt, delta, ring))
    return out
