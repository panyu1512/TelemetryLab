"""The coach: lap in, analysis out.

:class:`Coach` is fed every telemetry frame. When a lap completes it is lined up
against the reference — the quickest clean lap since the bridge joined this
track in this car — and every corner is measured and given a cause. The result
is a :class:`CoachingSnapshot`, published on the ``coaching`` channel.

What the coach deliberately does *not* do is choose what to say. It sends every
corner, gains included, with numbers and a cause; which ones become tips, and
above what loss, is the overlay's call (`src/lib/coaching.ts`), because those
are preferences the driver sets in the Manager, not facts about the lap.

Lifecycle
---------
- ``set_track`` names the context. A different track, layout or car is a
  different reference and a different corner map, so it starts over.
- The corner map is drawn from the *first* clean lap and then kept: corner
  numbers must not reshuffle under the driver mid-session just because a new
  best lap was a few metres different through a kink.
- A clean lap quicker than the reference becomes the new reference — after it
  has been compared with the old one, so a new best still shows where it came
  from.

The session best
----------------
Alongside its own reference the coach keeps the **session best**: the fastest
clean lap anybody in the player's class has driven since it joined this
context, timed from lap distance by :class:`~.field.FieldLapTimer` (the
service feeds it every car with :meth:`Coach.feed_field`), or the player's own
when theirs is quicker. Each lap is held against it corner by corner as well
(``vsBest``) — the time only, since the coach has nobody else's pedals — and,
like the reference, a lap that beats it is compared first and kept after.
"""

from __future__ import annotations

from collections import deque
from collections.abc import Iterable
from dataclasses import dataclass, field, replace
from typing import Any

from .compare import DRIVER_CAUSES, CornerAnalysis, compare_lap
from .corners import Corner, Ring, detect_corners, ring_for
from .field import FieldLapTimer, TimedLap, compare_to_best, timed_from_resampled
from .laps import LapRecorder, RecordedLap, ResampledLap, grid_points, resample

#: How many recent compared laps the "N of the last M" tally looks back over.
REPEAT_WINDOW = 6


@dataclass(slots=True)
class CoachingSnapshot:
    """The ``coaching`` channel payload. Mirrors ``CoachingPayload`` in TS."""

    state: str  # "waiting" | "analysed" | "skipped"
    track_length_m: float | None
    reference: dict[str, Any] | None
    last_lap: dict[str, Any] | None
    new_reference: bool
    corners: list[dict[str, Any]] = field(default_factory=list)
    analysis: list[CornerAnalysis] = field(default_factory=list)
    laps_analysed: int = 0
    #: The fastest clean lap in the player's class right now (`TimedLap.ref`).
    session_best: dict[str, Any] | None = None
    #: The last lap against the session best as it stood before it: that lap's
    #: ref, plus ``delta`` and per-corner ``corners``. None when not compared.
    vs_best: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "state": self.state,
            "trackLengthM": self.track_length_m,
            "reference": self.reference,
            "lastLap": self.last_lap,
            "newReference": self.new_reference,
            "corners": self.corners,
            "analysis": [a.to_dict() for a in self.analysis],
            "lapsAnalysed": self.laps_analysed,
            "sessionBest": self.session_best,
            "vsBest": self.vs_best,
        }


class Coach:
    def __init__(self) -> None:
        self._track_key: str | None = None
        self._track_length_m: float | None = None
        self._recorder = LapRecorder()
        self._field = FieldLapTimer()
        self._player_car_idx: int | None = None
        self._reset_state()

    def _reset_state(self) -> None:
        self._field.reset()
        self._best: TimedLap | None = None
        self._reference: ResampledLap | None = None
        self._corners: list[Corner] = []
        self._ring: Ring | None = None
        self._tally: dict[int, deque[str]] = {}
        self._laps_analysed = 0
        self._last: CoachingSnapshot | None = None

    # --- context --------------------------------------------------------------
    def reset(self) -> None:
        """Forget everything (iRacing went away)."""
        self._track_key = None
        self._track_length_m = None
        self._recorder.reset()
        self._reset_state()

    def set_track(self, key: str, length_m: float | None) -> bool:
        """Name the track/layout/car. Returns True when that started a new context."""
        if key == self._track_key:
            return False
        self._track_key = key
        self._track_length_m = length_m if length_m and length_m > 0 else None
        self._recorder.reset()
        self._reset_state()
        return True

    @property
    def track_key(self) -> str | None:
        return self._track_key

    # --- frames ---------------------------------------------------------------
    def feed(self, frame: dict[str, Any], traffic: bool = False) -> CoachingSnapshot | None:
        """Feed one telemetry frame; returns a snapshot when a lap completes."""
        lap = self._recorder.add(frame, traffic)
        if lap is None:
            return None
        self._last = self.analyse(lap)
        return self._last

    def feed_field(
        self,
        session_time: Any,
        arrays: dict[str, Any],
        cars: Iterable[int],
        player_car_idx: int,
    ) -> bool:
        """Feed one frame of every car's lap distance; True when the session best moved.

        ``cars`` are the cars worth comparing with — the player's class. The
        player's own laps are left to :meth:`feed`, which has their inputs.
        """
        self._player_car_idx = player_car_idx
        others = [c for c in cars if c != player_car_idx]
        moved = False
        for lap in self._field.feed(session_time, arrays, others):
            if self._best is None or lap.lap_time < self._best.lap_time:
                self._best = lap
                moved = True
        return moved

    def snapshot(self) -> CoachingSnapshot:
        """The latest analysis, or the waiting state before there is one.

        Either way it carries the session best as it stands now, so a client
        sees a new one without waiting for the player's next lap.
        """
        best = self._best_ref()
        if self._last is not None:
            return replace(self._last, session_best=best)
        return CoachingSnapshot(
            state="waiting",
            track_length_m=self._track_length_m,
            reference=None,
            last_lap=None,
            new_reference=False,
            session_best=best,
        )

    def _best_ref(self) -> dict[str, Any] | None:
        return self._best.ref() if self._best is not None else None

    # --- analysis -------------------------------------------------------------
    def analyse(self, lap: RecordedLap) -> CoachingSnapshot:
        snap, current = self._against_reference(lap)
        if current is not None:
            best = self._best
            if best is not None and self._corners:
                gaps = compare_to_best(current, best, self._corners)
                snap.vs_best = {
                    **best.ref(),
                    "delta": round(current.lap_time - best.lap_time, 3),
                    "corners": [g.to_dict() for g in gaps],
                }
            if current.clean and (best is None or current.lap_time < best.lap_time):
                self._best = timed_from_resampled(current, self._player_car_idx)
        snap.session_best = self._best_ref()
        return snap

    def _against_reference(self, lap: RecordedLap) -> tuple[CoachingSnapshot, ResampledLap | None]:
        """The coach proper: ``lap`` against the reference, and the lap resampled."""
        last = {
            "lap": lap.lap,
            "lapTime": round(lap.lap_time, 3),
            "valid": lap.clean,
            "invalidReason": lap.invalid_reason,
            "delta": None,
        }
        if not lap.comparable:
            state = "skipped" if self._reference else "waiting"
            return self._snap(state, last, False, []), None

        points = self._reference.n if self._reference else grid_points(self._track_length_m)
        current = resample(lap, points)

        if self._reference is None:
            if not current.clean:
                return self._snap("waiting", last, False, []), current
            self._reference = current
            self._ring = ring_for(current, self._track_length_m)
            self._corners = detect_corners(current, self._track_length_m)
            return self._snap("analysed", last, True, []), current

        ref = self._reference
        ring = self._ring
        assert ring is not None
        last["delta"] = round(current.lap_time - ref.lap_time, 3)
        analysis = compare_lap(current, ref, self._corners, ring) if self._corners else []
        self._laps_analysed += 1
        self._count_repeats(analysis)

        new_best = current.clean and current.lap_time < ref.lap_time
        snap = self._snap("analysed", last, new_best, analysis, ref)
        if new_best:
            self._reference = current
            snap.reference = self._lap_ref(current)
        return snap, current

    def _count_repeats(self, analysis: list[CornerAnalysis]) -> None:
        for a in analysis:
            history = self._tally.setdefault(a.corner, deque(maxlen=REPEAT_WINDOW))
            history.append(a.cause)
            a.repeat_window = len(history)
            a.repeat = sum(1 for c in history if c == a.cause) if a.cause in DRIVER_CAUSES else 0

    @staticmethod
    def _lap_ref(lap: ResampledLap) -> dict[str, Any]:
        return {"lap": lap.lap, "lapTime": round(lap.lap_time, 3)}

    def _snap(
        self,
        state: str,
        last: dict[str, Any],
        new_reference: bool,
        analysis: list[CornerAnalysis],
        ref: ResampledLap | None = None,
    ) -> CoachingSnapshot:
        ref = ref or self._reference
        n = ref.n if ref else 0
        return CoachingSnapshot(
            state=state,
            track_length_m=self._track_length_m,
            reference=self._lap_ref(ref) if ref else None,
            last_lap=last,
            new_reference=new_reference,
            corners=[_corner_dict(c, n) for c in self._corners],
            analysis=analysis,
            laps_analysed=self._laps_analysed,
        )


def _corner_dict(c: Corner, n: int) -> dict[str, Any]:
    last = max(1, n - 1)
    return {
        "number": c.number,
        "label": c.label,
        "startPct": round(c.start / last, 4),
        "entryPct": round(c.entry / last, 4),
        "apexPct": round(c.apex / last, 4),
        "exitPct": round(c.exit / last, 4),
    }
