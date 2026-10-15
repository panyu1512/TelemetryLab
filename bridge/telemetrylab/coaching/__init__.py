"""Corner-by-corner coaching from the player's own laps.

Every lap the player completes is lined up against their quickest clean lap,
split into corners, and each corner is measured — braking point, entry, apex
and exit speed, throttle pick-up, coasting — and given a cause. The overlay
turns the biggest losses into one-line tips.

    frames ─▶ LapRecorder ─▶ resample ─▶ compare_lap ─▶ CoachingSnapshot
                                 ▲            ▲              ▲
                     reference lap ─▶ detect_corners         │
                                                             │
    CarIdx arrays ─▶ FieldLapTimer ─▶ session best ─▶ compare_to_best

The second line is the session best: every car in the player's class timed
from lap distance, so the player's lap can be held against the quickest one
out there — how much each corner cost, not why (see :mod:`.field`).

Everything here is pure Python with no dependencies: it runs once per lap on a
few thousand points, and keeping numpy out keeps the bridge's onefile exe small.
"""

from __future__ import annotations

from .coach import Coach, CoachingSnapshot
from .compare import CAUSES, CornerAnalysis, classify, compare_lap
from .corners import Corner, detect_corners
from .field import BestGap, FieldLapTimer, TimedLap, compare_to_best
from .laps import LapRecorder, RecordedLap, ResampledLap, resample

__all__ = [
    "CAUSES",
    "BestGap",
    "Coach",
    "CoachingSnapshot",
    "Corner",
    "CornerAnalysis",
    "FieldLapTimer",
    "LapRecorder",
    "RecordedLap",
    "ResampledLap",
    "TimedLap",
    "classify",
    "compare_to_best",
    "compare_lap",
    "detect_corners",
    "resample",
]
