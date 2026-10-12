"""A synthetic lap of Spa, driven by a driver whose mistakes are known.

The coach (:mod:`telemetrylab.coaching`) claims to find *where* a lap lost time
and *why*. That claim is only testable against laps whose mistakes are known in
advance, so this module builds them: a speed profile over lap distance with six
corners roughly where Spa's are, and a :class:`Mistake` per corner that bends
that profile the way a real error does — braking early, rolling in off the
pedals, over-slowing, overdriving the entry, picking the throttle up late.

    speed ▲          clean ─────        braked 25 m early ─ ─ ─
          │ ───────╮                ╭──────
          │         ╲              ╱
          │       ─ ─╲            ╱
          │           ╲__________╱    ← holds apex speed for 25 m
          └──────────────────────────────▶ lap distance

It is used twice, deliberately the same code both times:

- the **mock bridge** drives the player's car with it, so the coach overlay
  runs end to end on macOS/Linux with no sim, and
- the **tests** feed it straight to the coach and assert the analysis recovers
  exactly the mistakes that were injected.

The physics is kinematic, not dynamic: speed is the lowest of every corner's
braking and acceleration rays at each metre, pedals are read off the shape of
that curve, and time is integrated from it. That is enough for every channel to
agree with every other one — which is all the coach reads.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

#: Spa-Francorchamps' lap length, metres.
TRACK_LENGTH_M = 7004.0

#: Top speed on the straights, km/h.
V_MAX = 258.0
#: Braking rate, km/h shed per metre. ~127 m from V_MAX down to La Source.
BRAKE_RATE = 1.5
#: Acceleration rate, km/h gained per metre. Shallower than braking, as it is.
ACCEL_RATE = 0.23

#: Partial throttle held while rolling at apex speed (an early brake, a late
#: pick-up) — enough to read as "not committed", well under the 0.9 the coach
#: counts as back on the power.
HOLD_THROTTLE = 0.25
#: How quickly a car rolling off the pedals sheds speed, km/h per metre —
#: aero drag at ~250 km/h is most of a g, so a long lift costs real speed.
COAST_RATE = 0.3


@dataclass(frozen=True, slots=True)
class MockCorner:
    """One corner: where its apex is (lap fraction) and how fast it is taken."""

    apex_pct: float
    apex_kmh: float
    name: str


#: Ordered round the lap. Positions and speeds as in the app's own mock
#: (`src/lib/mockData.ts`), so both mocks describe the same lap.
CORNERS: tuple[MockCorner, ...] = (
    MockCorner(0.02, 68.0, "La Source"),
    MockCorner(0.29, 118.0, "Les Combes"),
    MockCorner(0.40, 92.0, "Rivage"),
    MockCorner(0.55, 165.0, "Pouhon"),
    MockCorner(0.73, 128.0, "Stavelot"),
    MockCorner(0.94, 62.0, "Bus Stop"),
)


@dataclass(frozen=True, slots=True)
class Mistake:
    """How one corner was driven worse than the clean line. All zero = clean.

    - ``brake_early_m`` — braked this much earlier, then rolled at apex speed.
    - ``coast_m`` — lifted off both pedals this far before the braking point.
    - ``apex_slow_kmh`` — took the apex this much slower (over-slowed).
    - ``brake_late_m`` — braked this much later, harder; pair it with
      ``apex_slow_kmh`` for an overdriven entry that runs wide.
    - ``throttle_late_m`` — rolled at apex speed this far before picking up
      the throttle.
    """

    brake_early_m: float = 0.0
    coast_m: float = 0.0
    apex_slow_kmh: float = 0.0
    brake_late_m: float = 0.0
    throttle_late_m: float = 0.0


CLEAN = Mistake()


@dataclass(slots=True)
class MockLap:
    """One driven lap, sampled every metre of the track.

    ``t[i]`` is the time since the line at metre ``i``; ``t[-1]`` is the lap
    time. Every list has ``len(t)`` entries, one per metre plus the line itself.
    """

    t: list[float]
    speed: list[float]
    throttle: list[float]
    brake: list[float]
    gear: list[int]
    mistakes: dict[int, Mistake] = field(default_factory=dict)

    @property
    def lap_time(self) -> float:
        return self.t[-1]

    @property
    def metres(self) -> int:
        return len(self.t) - 1

    def at_time(self, t: float) -> dict[str, float]:
        """Interpolated state ``t`` seconds after the line (clamped to the lap)."""
        t = max(0.0, min(self.lap_time, t))
        lo, hi = 0, len(self.t) - 1
        while hi - lo > 1:  # binary search: `t` is strictly increasing
            mid = (lo + hi) // 2
            if self.t[mid] <= t:
                lo = mid
            else:
                hi = mid
        span = self.t[hi] - self.t[lo]
        f = 0.0 if span <= 0 else (t - self.t[lo]) / span
        metre = lo + f
        return {
            "pct": metre / self.metres,
            "speed": _lerp(self.speed[lo], self.speed[hi], f),
            "throttle": _lerp(self.throttle[lo], self.throttle[hi], f),
            "brake": _lerp(self.brake[lo], self.brake[hi], f),
            "gear": float(self.gear[lo]),
        }


def _lerp(a: float, b: float, f: float) -> float:
    return a + (b - a) * f


def _cyclic_ahead(frm: float, to: float, length: float) -> float:
    """Forward distance from ``frm`` to ``to`` round a lap of ``length``."""
    return (to - frm) % length


GEAR_STEPS = (0.0, 72.0, 108.0, 145.0, 186.0, 232.0)


def gear_for(kmh: float) -> int:
    gear = 1
    for i, lo in enumerate(GEAR_STEPS):
        if kmh >= lo:
            gear = i + 1
    return gear


def drive_lap(
    mistakes: dict[int, Mistake] | None = None,
    *,
    length_m: float = TRACK_LENGTH_M,
    corners: tuple[MockCorner, ...] = CORNERS,
) -> MockLap:
    """Drive one lap with ``mistakes`` (keyed by corner index) and sample it."""
    mistakes = mistakes or {}
    n = int(round(length_m))
    apex_m = [c.apex_pct * length_m for c in corners]

    # Per corner: apex speed, the hold before the apex (early brake), the
    # braking slope, and the hold after it (late throttle).
    params = []
    for i, c in enumerate(corners):
        m = mistakes.get(i, CLEAN)
        va = c.apex_kmh - m.apex_slow_kmh
        hold_in = max(0.0, m.brake_early_m)
        # A late brake reaches the same apex from a braking point further on:
        # the same speed has to go in less road, so the slope steepens.
        clean_zone = (V_MAX - va) / BRAKE_RATE
        zone = max(20.0, clean_zone - max(0.0, m.brake_late_m))
        slope = (V_MAX - va) / zone
        params.append((va, hold_in, slope, max(0.0, m.throttle_late_m)))

    def target(d: float) -> tuple[float, int | None, str]:
        """Speed at metre ``d``, the corner binding it, and which ray binds."""
        best, which, phase = V_MAX, None, "straight"
        for i, (va, hold_in, slope, hold_out) in enumerate(params):
            before = _cyclic_ahead(d, apex_m[i], length_m)  # metres to the apex
            after = _cyclic_ahead(apex_m[i], d, length_m)  # metres past it
            if before <= length_m / 2:
                v = va + slope * max(0.0, before - hold_in)
                ph = "hold" if before < hold_in else "brake"
            else:
                v = va + ACCEL_RATE * max(0.0, after - hold_out)
                ph = "hold" if after < hold_out else "accel"
            if v < best:
                best, which, phase = v, i, ph
        return best, which, phase

    speed = [0.0] * (n + 1)
    phase = ["straight"] * (n + 1)
    owner: list[int | None] = [None] * (n + 1)
    for d in range(n + 1):
        speed[d], owner[d], phase[d] = target(float(d % n))

    # Coasting: lifted off both pedals `coast_m` before the braking point. From
    # the lift the car rolls down a shallow coast line; wherever the braking
    # ray is lower, it takes over — so the stop itself starts later and from
    # less speed, the way a lift-and-coast actually drives.
    coast = [False] * (n + 1)
    for i, m in mistakes.items():
        if m.coast_m <= 0:
            continue
        brake_start = _brake_start(i, apex_m[i], phase, owner, n)
        if brake_start is None:
            continue
        lift = brake_start - int(round(m.coast_m))
        v_lift = speed[lift % n]
        reach = int(_cyclic_ahead(float(lift % n), apex_m[i], length_m))
        for k in range(reach + 1):
            d = (lift + k) % n
            line = v_lift - COAST_RATE * k
            if line < speed[d]:
                speed[d] = line
                coast[d] = True
    speed[n] = speed[0]
    coast[n] = coast[0]

    throttle = [1.0] * (n + 1)
    brake = [0.0] * (n + 1)
    for d in range(n + 1):
        nxt = speed[(d + 1) % n]
        dv = nxt - speed[d % n]
        if coast[d]:
            throttle[d], brake[d] = 0.0, 0.0
        elif phase[d] == "hold":
            throttle[d], brake[d] = HOLD_THROTTLE, 0.0
        elif dv < -0.2:
            throttle[d] = 0.0
            # Pressure scales with how hard the car is slowing: a steeper,
            # later stop reads as more brake.
            brake[d] = max(0.2, min(1.0, 0.85 * (-dv) / BRAKE_RATE))
        elif phase[d] == "brake" and dv < 0:
            # The last metres into the apex: trail off the brake.
            throttle[d], brake[d] = 0.0, 0.15
        else:
            throttle[d], brake[d] = 1.0, 0.0

    t = [0.0] * (n + 1)
    for d in range(1, n + 1):
        v_ms = max(1.0, (speed[d - 1] + speed[d]) / 2.0) / 3.6
        t[d] = t[d - 1] + 1.0 / v_ms
    gear = [gear_for(v) for v in speed]
    return MockLap(
        t=t, speed=speed, throttle=throttle, brake=brake, gear=gear, mistakes=dict(mistakes)
    )


def _brake_start(
    corner: int,
    apex: float,
    phase: list[str],
    owner: list[int | None],
    n: int,
) -> int | None:
    """First metre of ``corner``'s braking ray, walking back from its apex."""
    d = int(apex) % n
    seen = False
    for _ in range(n // 2):
        if owner[d] == corner and phase[d] in ("brake", "hold"):
            seen = True
        elif seen:
            return (d + 1) % n
        d = (d - 1) % n
    return None


# ---------------------------------------------------------------------------
# The mock driver: a deterministic sequence of laps with varied mistakes
# ---------------------------------------------------------------------------


def _hash01(lap: int, corner: int, salt: int = 0) -> float:
    """Deterministic 0–1 value per (lap, corner): varied, but repeatable."""
    x = math.sin(lap * 12.9898 + corner * 78.233 + salt * 37.719) * 43758.5453
    return x - math.floor(x)


#: Share of corners driven with a mistake. Most of a lap is clean; a third of
#: corners carrying one keeps every lap different without every lap being bad.
MISTAKE_CHANCE = 0.3


def mistakes_for_lap(lap: int) -> dict[int, Mistake]:
    """The mistakes the mock driver makes on ``lap``. Pure: same lap, same lap.

    Corner 2 (Rivage) is this driver's weak spot — braked early on most laps —
    so the coach's "N of the last M laps" tally has something to find.
    """
    out: dict[int, Mistake] = {}
    for c in range(len(CORNERS)):
        h = _hash01(lap, c)
        if c == 2 and _hash01(lap, c, 7) < 0.7:
            out[c] = Mistake(brake_early_m=10.0 + 14.0 * _hash01(lap, c, 3))
            continue
        if h >= MISTAKE_CHANCE:
            continue
        size = _hash01(lap, c, 1)
        kind = int(_hash01(lap, c, 2) * 5)
        if kind == 0:
            out[c] = Mistake(brake_early_m=9.0 + 20.0 * size)
        elif kind == 1:
            # La Source comes straight off the Bus Stop, still accelerating:
            # there is no straight to lift on, only a short roll in.
            out[c] = Mistake(coast_m=(30.0 + 20.0 * size) if c == 0 else 80.0 + 100.0 * size)
        elif kind == 2:
            out[c] = Mistake(apex_slow_kmh=4.0 + 8.0 * size)
        elif kind == 3:
            out[c] = Mistake(brake_late_m=8.0 + 10.0 * size, apex_slow_kmh=4.0 + 6.0 * size)
        else:
            out[c] = Mistake(throttle_late_m=15.0 + 30.0 * size)
    return out


class MockDriver:
    """The player's car on the mock track: which lap, where, at time ``t``.

    Laps are driven lazily and cached; lap ``k`` starts when lap ``k-1`` ends,
    so the session clock and every lap time agree. ``start_pct`` places the car
    part-way round its first lap, so a first lap boundary is seconds away
    rather than a whole lap.
    """

    def __init__(self, start_pct: float = 0.9) -> None:
        self._laps: dict[int, MockLap] = {}
        first = self.lap(0)
        # Session time 0 is `start_pct` of the way round lap 0, so lap 0
        # started that long before it.
        self._starts: list[float] = [-first.t[int(start_pct * first.metres)]]

    def lap(self, k: int) -> MockLap:
        if k not in self._laps:
            self._laps[k] = drive_lap(mistakes_for_lap(k))
        return self._laps[k]

    def _lap_start(self, k: int) -> float:
        while len(self._starts) <= k:
            prev = len(self._starts) - 1
            self._starts.append(self._starts[prev] + self.lap(prev).lap_time)
        return self._starts[k]

    def lap_at(self, t: float) -> int:
        k = 0
        while self._lap_start(k + 1) <= t:
            k += 1
        return k

    def state(self, t: float) -> dict[str, float]:
        """Lap number, lap fraction and pedals at session time ``t``."""
        k = self.lap_at(t)
        lap = self.lap(k)
        s = lap.at_time(t - self._lap_start(k))
        s["lap"] = float(k)
        s["lap_time_so_far"] = t - self._lap_start(k)
        return s

    def last_lap_time(self, t: float) -> float | None:
        k = self.lap_at(t)
        return None if k == 0 else self.lap(k - 1).lap_time

    def best_lap_time(self, t: float) -> float | None:
        k = self.lap_at(t)
        done = [self.lap(i).lap_time for i in range(1, k)]
        return min(done) if done else None
