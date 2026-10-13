"""Find the corners of a track from one clean lap of it.

iRacing publishes no corner map, so the coach draws its own from the reference
lap: a corner is wherever the car slows to a clear minimum and comes back up.

    speed ▲ ─────╮                       ╭──── full throttle again
          │       ╲ braking        exit ╱
          │        ╲                   ╱
          │         ╲_______●_________╱
          │   start  entry  apex     exit
          └────┬──────┬──────┬────────┬────────▶ lap distance
               │◀──────────── segment ───────────▶│ (to the next start)

Each corner carries four grid indices:

- ``apex`` — the speed minimum.
- ``entry`` — walking back from the apex, the first point where the driver
  was flat out (full throttle, no brake). Everything after it — a lift, a
  coast, the stop itself — belongs to the corner.
- ``exit`` — walking forward, the start of the first 30 m held flat out.
- ``start`` — the segment boundary, set a margin before ``entry`` so a lap
  that brakes *earlier* than the reference still brakes inside this corner's
  segment rather than the previous one's.

Segments run from one corner's ``start`` to the next's and wrap over the line,
so they partition the lap: the time lost in every segment adds up to exactly
the lap-time difference. The straight after a corner is in that corner's
segment on purpose — a slow exit costs its time on the straight.

The grid is treated as a ring of ``m = n - 1`` points (the last point of a
resampled lap is the line again), because Spa's La Source, like most first
corners, starts braking before the line and finishes after it.
"""

from __future__ import annotations

from dataclasses import dataclass

from .laps import ResampledLap

#: A corner must shed at least this much speed on the way in (km/h) …
MIN_DROP_KMH = 12.0
#: … and regain at least this much on the way out, within the search reach.
MIN_RECOVER_KMH = 8.0
#: How far either side of a minimum to look for that drop and recovery.
PROMINENCE_REACH_M = 300.0
#: Two minima closer than this are one corner (a chicane, a double apex).
MERGE_M = 70.0
#: Window over which a minimum must be the lowest point.
MINIMUM_WINDOW_M = 40.0
#: Speed smoothing window, metres — irons out a frame's jitter, not a corner.
SMOOTH_M = 14.0
#: Throttle at or above this, with the brake at or below ``FLAT_BRAKE``, is
#: flat out.
FLAT_THROTTLE = 0.95
FLAT_BRAKE = 0.05
#: Held flat for this long after the apex = the corner is over.
EXIT_HOLD_M = 30.0
#: How far a corner may reach either side of its apex.
MAX_REACH_M = 600.0
#: Segment boundary margin before the reference lap's entry.
START_MARGIN_M = 80.0


@dataclass(frozen=True, slots=True)
class Corner:
    """One detected corner, as indices on the resampled lap's ring."""

    number: int  # 1-based, in order from the line
    start: int
    entry: int
    apex: int
    exit: int

    @property
    def label(self) -> str:
        return f"T{self.number}"


class Ring:
    """Index arithmetic on a ring of ``m`` grid points ``step_m`` apart."""

    def __init__(self, m: int, step_m: float) -> None:
        self.m = m
        self.step_m = step_m

    def wrap(self, i: int) -> int:
        return i % self.m

    def ahead(self, a: int, b: int) -> int:
        """Points from ``a`` forward to ``b``."""
        return (b - a) % self.m

    def points(self, metres: float) -> int:
        return max(1, int(round(metres / self.step_m)))

    def span(self, a: int, b: int) -> list[int]:
        """Indices from ``a`` forward to ``b``, both included."""
        return [(a + k) % self.m for k in range(self.ahead(a, b) + 1)]


def ring_for(lap: ResampledLap, track_length_m: float | None) -> Ring:
    m = lap.n - 1
    length = track_length_m if track_length_m and track_length_m > 0 else m * 2.0
    return Ring(m, length / m)


def _smooth(values: list[float], ring: Ring, half: int) -> list[float]:
    m = ring.m
    out = [0.0] * m
    window = 2 * half + 1
    total = sum(values[(i % m)] for i in range(-half, half + 1))
    for i in range(m):
        out[i] = total / window
        total += values[(i + half + 1) % m] - values[(i - half) % m]
    return out


def detect_corners(lap: ResampledLap, track_length_m: float | None) -> list[Corner]:
    """Detect the corners of ``lap`` (normally the first clean reference lap)."""
    ring = ring_for(lap, track_length_m)
    m = ring.m
    speed = _smooth(lap.speed[:m], ring, ring.points(SMOOTH_M / 2))
    throttle = lap.throttle[:m]
    brake = lap.brake[:m]

    win = ring.points(MINIMUM_WINDOW_M)
    reach = ring.points(PROMINENCE_REACH_M)

    apexes: list[int] = []
    for i in range(m):
        v = speed[i]
        # Lowest in its window; ties go to the first point of a flat bottom.
        if any(speed[ring.wrap(i - k)] <= v for k in range(1, win + 1)):
            continue
        if any(speed[ring.wrap(i + k)] < v for k in range(1, win + 1)):
            continue
        before = max(speed[ring.wrap(i - k)] for k in range(1, reach + 1))
        after = max(speed[ring.wrap(i + k)] for k in range(1, reach + 1))
        if before - v >= MIN_DROP_KMH and after - v >= MIN_RECOVER_KMH:
            apexes.append(i)

    apexes = _merge(apexes, speed, ring)
    if not apexes:
        return []
    # Smoothing finds the corner; the raw trace places it. A moving average of
    # an asymmetric V — braking steep, acceleration shallow — drifts its
    # minimum towards the shallow side, by metres that would then be charged
    # to the throttle pick-up of every lap compared against it.
    raw = lap.speed
    near = ring.points(SMOOTH_M)
    apexes = [
        min(
            (ring.wrap(a + k) for k in range(-near, near + 1)),
            key=lambda i: (raw[i], ring.ahead(ring.wrap(a - near), i)),
        )
        for a in apexes
    ]

    def flat(i: int) -> bool:
        return throttle[i] >= FLAT_THROTTLE and brake[i] <= FLAT_BRAKE

    max_reach = ring.points(MAX_REACH_M)
    hold = ring.points(EXIT_HOLD_M)
    corners: list[tuple[int, int, int]] = []
    count = len(apexes)
    for k, apex in enumerate(apexes):
        prev_apex = apexes[k - 1] if count > 1 else ring.wrap(apex + m // 2)
        next_apex = apexes[(k + 1) % count] if count > 1 else ring.wrap(apex + m // 2)

        # Entry: back from the apex to the end of the last run held flat out.
        # A run, not a single point: at the apex itself the driver is often
        # already back on the power, and one flat point there is not a straight.
        back_limit = min(max_reach, ring.ahead(prev_apex, apex) - 1)
        entry = ring.wrap(apex - back_limit)
        run = 0
        for j in range(1, back_limit + 1):
            i = ring.wrap(apex - j)
            run = run + 1 if flat(i) else 0
            if run >= hold:
                # The run spans i … i + hold - 1; the corner starts after it.
                entry = ring.wrap(i + hold)
                break

        # Exit: forward to the start of the first run held flat out.
        fwd_limit = min(max_reach, ring.ahead(apex, next_apex) - 1)
        exit_ = ring.wrap(apex + fwd_limit)
        run = 0
        for j in range(1, fwd_limit + 1):
            i = ring.wrap(apex + j)
            run = run + 1 if flat(i) else 0
            if run >= hold:
                exit_ = ring.wrap(i - hold + 1)
                break
        corners.append((entry, apex, exit_))

    # Segment starts: a margin before each entry, but never back past the
    # previous corner's exit (nor half-way to it on a short straight).
    margin = ring.points(START_MARGIN_M)
    out: list[Corner] = []
    for k, (entry, apex, exit_) in enumerate(corners):
        prev_exit = corners[k - 1][2] if count > 1 else ring.wrap(entry + 1)
        room = ring.ahead(prev_exit, entry)
        start = ring.wrap(entry - min(margin, room // 2))
        out.append(Corner(number=0, start=start, entry=entry, apex=apex, exit=exit_))

    # Number from the line: the first segment to start at or after point 0.
    # A corner whose segment straddles the line (La Source) is T1 when its
    # apex is in the first half of the lap.
    out.sort(key=lambda c: c.apex)
    return [
        Corner(number=i + 1, start=c.start, entry=c.entry, apex=c.apex, exit=c.exit)
        for i, c in enumerate(out)
    ]


def _merge(apexes: list[int], speed: list[float], ring: Ring) -> list[int]:
    """Collapse minima closer than ``MERGE_M`` into the slowest of them."""
    if len(apexes) < 2:
        return apexes
    gap = ring.points(MERGE_M)
    merged: list[int] = []
    for a in sorted(apexes):
        if merged and ring.ahead(merged[-1], a) < gap:
            if speed[a] < speed[merged[-1]]:
                merged[-1] = a
        else:
            merged.append(a)
    # And across the line: the last and first may be one corner.
    if len(merged) > 1 and ring.ahead(merged[-1], merged[0]) < gap:
        last = merged.pop()
        if speed[last] < speed[merged[0]]:
            merged[0] = last
    return merged
