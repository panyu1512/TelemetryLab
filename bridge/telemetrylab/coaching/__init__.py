"""Corner-by-corner coaching from the player's own laps.

Every lap the player completes is lined up against their quickest clean lap,
split into corners, and each corner is measured — braking point, entry, apex
and exit speed, throttle pick-up, coasting — and given a cause. The overlay
turns the biggest losses into one-line tips.

    frames ─▶ LapRecorder ─▶ resample ─▶ compare_lap ─▶ CoachingSnapshot
                                 ▲            ▲
                     reference lap ─▶ detect_corners

Everything here is pure Python with no dependencies: it runs once per lap on a
few thousand points, and keeping numpy out keeps the bridge's onefile exe small.
"""

from __future__ import annotations

from .coach import Coach, CoachingSnapshot
from .compare import CAUSES, CornerAnalysis, classify, compare_lap
from .corners import Corner, detect_corners
from .laps import LapRecorder, RecordedLap, ResampledLap, resample

__all__ = [
    "CAUSES",
    "Coach",
    "CoachingSnapshot",
    "Corner",
    "CornerAnalysis",
    "LapRecorder",
    "RecordedLap",
    "ResampledLap",
    "classify",
    "compare_lap",
    "detect_corners",
    "resample",
]
