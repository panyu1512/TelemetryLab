"""Derive per-car sector timing from ``CarIdxLapDistPct`` crossings.

iRacing publishes finished **lap** times per car (``CarIdxLastLapTime``) but does
**not** expose per-opponent **sector** splits — those exist only for the player,
and even then not as a clean array. So for a field-wide timing screen the sector
times have to be *derived*: we know where the sector boundaries are on the lap
(``SplitTimeInfo.Sectors`` → a list of start percentages) and we watch each car's
``CarIdxLapDistPct`` tick past them, timestamping the crossings.

    lap distance:  0.0 ───▶ 0.33 ───▶ 0.66 ───▶ 1.0/0.0
                    │  S1   │   S2    │   S3     │
    crossing t:    t0      t1        t2         t3(=next t0)
    sector time:      t1-t0    t2-t1     t3-t2

Accuracy caveat
---------------
The clock is the standings-tick timestamp (~10 Hz), so a derived split carries up
to one tick (~100 ms) of quantisation on each edge. That is fine for a live
gap/board read-out and is the same technique every third-party timing overlay
uses; it is **not** a substitute for the sim's own player sector times. The wire
schema marks these as derived so the UI can present them honestly.

State model
-----------
Everything the standings/animation layers need is precomputed here so the
frontend never has to remember anything frame-to-frame:

- ``last_time``   — the most recently completed sector time.
- ``best_time``   — this car's personal best for that sector.
- ``status``      — ``overall_best`` / ``personal_best`` / ``slower`` /
  ``much_slower`` / ``none``: the semantic that drives the purple/green/yellow/red
  colouring (and, later, the colour-transition animations).

The field-wide best per sector lives on :class:`FieldSectorState`; the theoretical
best lap is simply the sum of a car's personal best sectors.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

# A sector split more than this many seconds over the car's own best is treated
# as "much slower" (red) rather than merely "slower" (yellow) — usually a lift,
# a mistake or traffic. Tunable; the colour thresholds are presentation, not truth.
MUCH_SLOWER_THRESHOLD = 0.75

# Guard rails: a backwards jump in lap distance bigger than this (that is not a
# clean start/finish wrap) means a reset/teleport/tow — abandon the in-flight
# sector instead of timing a garbage split.
_MAX_BACKWARD_PCT = 0.25


def parse_sector_starts(split_time_info: Any) -> list[float]:
    """Extract ordered sector start percentages from ``SplitTimeInfo``.

    Accepts iRacing's parsed ``{"Sectors": [{"SectorNum": 0, "SectorStartPct":
    0.0}, ...]}`` shape. Always returns a list that starts at ``0.0`` (a track
    with no sector info degrades to a single whole-lap "sector").
    """
    sectors: list[float] = []
    if isinstance(split_time_info, dict):
        for s in split_time_info.get("Sectors") or []:
            pct = s.get("SectorStartPct") if isinstance(s, dict) else None
            if isinstance(pct, (int, float)):
                sectors.append(float(pct))
    sectors = sorted(p for p in sectors if 0.0 <= p < 1.0)
    if not sectors or sectors[0] > 1e-6:
        sectors = [0.0, *sectors]
    return sectors


def _sector_index(pct: float, starts: list[float]) -> int:
    """Which sector a lap-distance fraction falls in (0-based)."""
    idx = 0
    for i, start in enumerate(starts):
        if pct >= start:
            idx = i
        else:
            break
    return idx


@dataclass(slots=True)
class SectorSplit:
    """A single completed sector time + how it grades against the bests."""

    index: int
    last_time: float | None = None
    best_time: float | None = None
    status: str = "none"

    def to_dict(self) -> dict[str, Any]:
        return {
            "index": self.index,
            "lastTime": self.last_time,
            "bestTime": self.best_time,
            # Signed delta vs this car's own best (negative = new personal best).
            "delta": (
                None
                if self.last_time is None or self.best_time is None
                else round(self.last_time - self.best_time, 3)
            ),
            "status": self.status,
        }


class CarSectorTracker:
    """Times sectors for one car by watching its lap-distance cross boundaries."""

    __slots__ = (
        "_n",
        "_starts",
        "_cur_sector",
        "_enter_ms",
        "_clean",
        "_last_pct",
        "_last_lap",
        "best",
        "last",
    )

    def __init__(self, starts: list[float]) -> None:
        self._starts = starts
        self._n = len(starts)
        self._cur_sector: int | None = None
        self._enter_ms: int | None = None
        # Whether the in-flight sector was entered at its *start* boundary. The
        # sector a car is first sighted in was joined mid-way, so its time would
        # be a partial — we only record sectors that were entered cleanly.
        self._clean: bool = False
        self._last_pct: float | None = None
        self._last_lap: int | None = None
        #: personal best time per sector index.
        self.best: dict[int, float] = {}
        #: last completed time per sector index.
        self.last: dict[int, float] = {}

    def _reset_flight(self, sector: int, ts_ms: int, clean: bool) -> None:
        """Start timing ``sector`` fresh from ``ts_ms`` without recording."""
        self._cur_sector = sector
        self._enter_ms = ts_ms
        self._clean = clean

    def update(
        self,
        pct: float | None,
        lap: int | None,
        ts_ms: int,
    ) -> int | None:
        """Feed one tick. Returns the index of a sector just *completed*, if any.

        The completing car's new personal/overall bests are the caller's job to
        fold in (it owns the field-wide board); we only track this car's splits.
        """
        if pct is None or self._n == 0:
            return None
        pct = min(0.999999, max(0.0, pct))
        sector = _sector_index(pct, self._starts)

        prev_pct = self._last_pct
        prev_sector = self._cur_sector
        self._last_pct = pct

        # First sighting, or after a reset: arm the current sector as *unclean*
        # (we joined it mid-way, so its eventual time would be a partial).
        if prev_sector is None or self._enter_ms is None:
            self._reset_flight(sector, ts_ms, clean=False)
            self._last_lap = lap
            return None

        lap_advanced = lap is not None and self._last_lap is not None and lap > self._last_lap
        self._last_lap = lap

        # Detect an invalid backwards jump (spin recovery, tow, reset) that is not
        # the normal start/finish wrap. Abandon the in-flight sector.
        went_backwards = prev_pct is not None and pct < prev_pct
        wrapped = went_backwards and (lap_advanced or prev_pct > 1.0 - _MAX_BACKWARD_PCT)
        if went_backwards and not wrapped:
            self._reset_flight(sector, ts_ms, clean=False)
            return None

        if sector == prev_sector and not wrapped:
            return None  # still inside the same sector

        # We crossed at least one boundary. Trust the split only when we advanced
        # by exactly one sector (incl. the wrap N-1 -> 0) *and* the sector was
        # entered at its start (not a mid-sector first sighting). A larger jump
        # means a tick was skipped over a short sector — can't attribute a time.
        completed = prev_sector
        expected_next = (prev_sector + 1) % self._n
        advanced_one = sector == expected_next
        split = (ts_ms - self._enter_ms) / 1000.0 if advanced_one and self._clean else None

        # The new sector is entered cleanly iff we crossed exactly its start.
        self._reset_flight(sector, ts_ms, clean=advanced_one)
        if split is None or split <= 0:
            return None

        self.last[completed] = split
        if completed not in self.best or split < self.best[completed]:
            self.best[completed] = split
        return completed

    def theoretical_best(self) -> float | None:
        """Sum of personal-best sectors — the ideal lap, if it exists in full."""
        if len(self.best) < self._n:
            return None
        return round(sum(self.best.values()), 3)


class FieldSectorState:
    """Owns every car's :class:`CarSectorTracker` plus the field-wide bests.

    A single instance lives inside the standings engine and persists across
    ticks. ``overall_best`` is the fastest anyone has run each sector this
    session — the "purple" reference.
    """

    def __init__(self, starts: list[float]) -> None:
        self._starts = starts
        self._trackers: dict[int, CarSectorTracker] = {}
        #: fastest time seen for each sector index across the whole field.
        self.overall_best: dict[int, float] = {}
        #: fastest full lap seen across the field (session best lap).
        self.overall_best_lap: float | None = None
        self.overall_best_lap_car: int | None = None

    @property
    def sector_count(self) -> int:
        return len(self._starts)

    def retune(self, starts: list[float]) -> None:
        """Adopt new sector boundaries (track/config change) — drops stale state."""
        if starts and starts != self._starts:
            self._starts = starts
            self._trackers.clear()
            self.overall_best.clear()
            self.overall_best_lap = None
            self.overall_best_lap_car = None

    def _tracker(self, car_idx: int) -> CarSectorTracker:
        t = self._trackers.get(car_idx)
        if t is None:
            t = CarSectorTracker(self._starts)
            self._trackers[car_idx] = t
        return t

    def observe(
        self,
        car_idx: int,
        pct: float | None,
        lap: int | None,
        last_lap_time: float | None,
        ts_ms: int,
    ) -> None:
        """Fold one car's tick into the field sector state."""
        tracker = self._tracker(car_idx)
        completed = tracker.update(pct, lap, ts_ms)
        if completed is not None:
            split = tracker.last[completed]
            if completed not in self.overall_best or split < self.overall_best[completed]:
                self.overall_best[completed] = split
        # Track the session's fastest full lap from the (trustworthy) sim value.
        if last_lap_time is not None and last_lap_time > 0:
            if self.overall_best_lap is None or last_lap_time < self.overall_best_lap:
                self.overall_best_lap = last_lap_time
                self.overall_best_lap_car = car_idx

    def splits_for(self, car_idx: int) -> list[SectorSplit]:
        """Graded per-sector splits for a car (drives the delta colouring)."""
        tracker = self._trackers.get(car_idx)
        out: list[SectorSplit] = []
        for i in range(self.sector_count):
            if tracker is None:
                out.append(SectorSplit(index=i))
                continue
            last = tracker.last.get(i)
            best = tracker.best.get(i)
            out.append(
                SectorSplit(
                    index=i, last_time=last, best_time=best, status=self._grade(i, last, best)
                )
            )
        return out

    def theoretical_best_for(self, car_idx: int) -> float | None:
        tracker = self._trackers.get(car_idx)
        return tracker.theoretical_best() if tracker else None

    def _grade(self, index: int, last: float | None, best: float | None) -> str:
        """Classify a sector's last time for purple/green/yellow/red colouring."""
        if last is None:
            return "none"
        overall = self.overall_best.get(index)
        if overall is not None and last <= overall + 1e-4:
            return "overall_best"  # purple — fastest in the field
        if best is not None and last <= best + 1e-4:
            return "personal_best"  # green — this car's own best
        if best is not None and last - best > MUCH_SLOWER_THRESHOLD:
            return "much_slower"  # red — big time loss
        return "slower"  # yellow — off personal best
