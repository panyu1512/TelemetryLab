"""The standings engine — turn raw per-car timing into a timing screen.

This is the brain behind the v0.4 standings/timing screen. Unlike the v0.3
skeleton it replaced, it is **stateful**: several of the things a timing screen
shows cannot be computed from a single frame — position change *since the green
flag*, gain/loss *over the last lap*, personal/overall best *sectors* — so the
engine carries a little history across ticks.

    per tick:   timings (CarIdx* arrays) ─┐
    persistent: sector board, start grid, ├─▶ StandingsEngine.compute()
                lap baselines, out-timers  ┘        │
                                                     ▼
                                            StandingsSnapshot (wire)

Direct vs derived
-----------------
Everything a row shows is one of:

* **Direct from iRacing** — ``position``, ``classPosition``, ``lap``,
  ``lapDistPct``, ``lastLapTime``, ``bestLapTime``, ``onPitRoad``,
  ``trackSurface``. We pass these through untouched.
* **Derived here** — gap/interval (from ``F2Time``/lap deltas), interval-to-player
  (from ``EstTime``), estimated catch time, position change, projected iRating,
  and *all* sector splits/deltas (iRacing gives no per-opponent sector times).

The projected iRating is an **estimate**, labelled as such on the wire, and the
sector splits are derived from lap-distance crossings (see :mod:`sectors`).
"""

from __future__ import annotations

import math

from .models import (
    CarTiming,
    ClassEntry,
    ClassStanding,
    DriverEntry,
    SessionInfo,
    StandingsEntry,
    StandingsSnapshot,
)
from .sectors import FieldSectorState

_INF = float("inf")

# How many consecutive not-in-world ticks before we call a car retired (vs a
# brief tow/reset). ~3 s at the 10 Hz standings cadence.
_RETIRE_TICKS = 30

# Projected-iRating spread: the estimated change for beating/missing your
# expected finish by the full field, scaled per place. Keeps the live projection
# in a believable ± band without pretending to be iRacing's exact points pool.
_IR_SCALE = 50.0

# A car must be gaining at least this many seconds per lap on the car ahead for a
# catch-time estimate to be meaningful (avoids dividing by pace noise).
_MIN_CLOSING_RATE = 0.05


def _sort_key(timing: CarTiming) -> tuple[float, float]:
    """Overall race order: by position, then by track progress as a tiebreak."""
    pos = timing.position if timing.position is not None else _INF
    progress = -((timing.lap or 0) + (timing.lap_dist_pct or 0.0))
    return (pos, progress)


def _projected_irating_changes(
    entries: list[tuple[int, int, int]],
) -> dict[int, int]:
    """Live projected iRating change for each car, from iR + current position.

    ``entries`` is ``(car_idx, i_rating, position)``. This is an **estimate**: it
    models each car's *expected* finishing place from pairwise Elo win
    probabilities and compares it to where the car currently runs. Beating your
    expected place projects a gain, running below it projects a loss. It is not
    iRacing's exact formula — it is a plausible, honest live indicator.
    """
    field = [(idx, ir, pos) for idx, ir, pos in entries if ir > 0 and pos]
    n = len(field)
    if n < 2:
        return {idx: 0 for idx, _, _ in field}

    out: dict[int, int] = {}
    for idx, ir, pos in field:
        # Expected place = 1 + Σ P(rival finishes ahead of me).
        expected = 1.0
        for jdx, jr, _ in field:
            if jdx == idx:
                continue
            expected += 1.0 / (1.0 + math.pow(10.0, (ir - jr) / 1600.0))
        # Positive when you're running ahead of expectation.
        out[idx] = int(round(_IR_SCALE * (expected - pos) / (n - 1)))
    return out


class StandingsEngine:
    """Owns the cross-tick state and produces a :class:`StandingsSnapshot`."""

    def __init__(self) -> None:
        self._session_id: str | None = None
        self._sectors = FieldSectorState([0.0])
        # Position-change history.
        self._start_pos: dict[int, int] = {}
        self._lap_baseline_pos: dict[int, int] = {}
        self._last_seen_lap: dict[int, int] = {}
        self._last_lap_gained: dict[int, int] = {}
        # Retirement detection.
        self._out_ticks: dict[int, int] = {}
        self._seen_in_world: set[int] = set()
        # Tyre stint tracking: detect pit-stall exit → assume fresh tyres.
        self._prev_in_pit_stall: dict[int, bool] = {}
        self._tire_stint_start_lap: dict[int, int] = {}

    # -- lifecycle -----------------------------------------------------------
    def _sync_session(self, session: SessionInfo) -> None:
        """Reset history on a new session; retune sectors on a new track."""
        starts = session.sector_starts or [0.0]
        if session.session_id != self._session_id:
            self._session_id = session.session_id
            self._start_pos.clear()
            self._lap_baseline_pos.clear()
            self._last_seen_lap.clear()
            self._last_lap_gained.clear()
            self._out_ticks.clear()
            self._seen_in_world.clear()
            self._prev_in_pit_stall.clear()
            self._tire_stint_start_lap.clear()
            self._sectors = FieldSectorState(starts)
        else:
            self._sectors.retune(starts)

    # -- per-tick position-change tracking -----------------------------------
    def _track_position(
        self, car_idx: int, position: int | None, lap: int | None, racing: bool
    ) -> None:
        if position is None:
            return
        # Capture the green-flag grid the first time we see a racing position.
        if racing and car_idx not in self._start_pos:
            self._start_pos[car_idx] = position
            self._lap_baseline_pos[car_idx] = position
            self._last_seen_lap[car_idx] = lap if lap is not None else 0
        # Snapshot the position at each lap boundary → gain/loss over last lap.
        if lap is not None:
            prev_lap = self._last_seen_lap.get(car_idx)
            if prev_lap is None:
                self._lap_baseline_pos[car_idx] = position
                self._last_seen_lap[car_idx] = lap
            elif lap > prev_lap:
                baseline = self._lap_baseline_pos.get(car_idx, position)
                self._last_lap_gained[car_idx] = baseline - position
                self._lap_baseline_pos[car_idx] = position
                self._last_seen_lap[car_idx] = lap

    def _track_presence(self, car_idx: int, in_world: bool) -> bool:
        """Update the out-of-world timer; return True if the car is retired."""
        if in_world:
            self._seen_in_world.add(car_idx)
            self._out_ticks[car_idx] = 0
            return False
        self._out_ticks[car_idx] = self._out_ticks.get(car_idx, 0) + 1
        return car_idx in self._seen_in_world and self._out_ticks[car_idx] >= _RETIRE_TICKS

    # -- main computation ----------------------------------------------------
    def compute(
        self,
        session: SessionInfo,
        drivers_by_idx: dict[int, DriverEntry],
        timings: dict[int, CarTiming],
        now_ms: int,
    ) -> StandingsSnapshot:
        self._sync_session(session)
        racing = session.session_state in (4, 5)  # racing | checkered

        # Only race cars with a roster entry; skip pace/spectator slots.
        rows: list[CarTiming] = [
            t
            for idx, t in timings.items()
            if (d := drivers_by_idx.get(idx)) is not None
            and not d.is_pace_car
            and not d.is_spectator
        ]
        rows.sort(key=_sort_key)

        # Pass 1: fold every car into the persistent state (sectors, best lap,
        # position history, presence) so per-row grading below sees fresh bests.
        retired_by_idx: dict[int, bool] = {}
        tire_laps_by_idx: dict[int, int] = {}
        for t in rows:
            in_world = t.track_surface is not None and t.track_surface >= 0
            self._sectors.observe(t.car_idx, t.lap_dist_pct, t.lap, t.last_lap_time, now_ms)
            self._track_position(t.car_idx, t.position, t.lap, racing)
            retired_by_idx[t.car_idx] = self._track_presence(t.car_idx, in_world)
            # Tyre stint: when a car leaves the pit stall, start a new set.
            in_pit_stall = t.track_surface_label == "in_pit_stall"
            was_in_pit_stall = self._prev_in_pit_stall.get(t.car_idx, False)
            if was_in_pit_stall and not in_pit_stall:
                self._tire_stint_start_lap[t.car_idx] = t.lap or 0
            self._prev_in_pit_stall[t.car_idx] = in_pit_stall
            tire_laps_by_idx[t.car_idx] = max(
                0, (t.lap or 0) - self._tire_stint_start_lap.get(t.car_idx, 0)
            )

        ir_changes = _projected_irating_changes(
            [(t.car_idx, drivers_by_idx[t.car_idx].i_rating, t.position or 0) for t in rows]
        )

        leader = rows[0] if rows else None
        leader_lap = leader.lap if leader else None
        # Class leaders in overall order (first car of each class we encounter).
        class_leader_seen: set[int] = set()

        entries: list[StandingsEntry] = []
        prev_time_gap: float | None = None
        prev_row: CarTiming | None = None
        for t in rows:
            driver = drivers_by_idx[t.car_idx]

            laps_down = (
                max(0, leader_lap - t.lap) if leader_lap is not None and t.lap is not None else 0
            )
            gap_is_laps = laps_down >= 1

            if t is leader:
                gap_to_leader: float | None = 0.0
                interval: float | None = 0.0
                prev_time_gap = 0.0
            elif gap_is_laps:
                gap_to_leader = float(laps_down)
                interval = None
            else:
                gap_to_leader = t.f2_time
                interval = (
                    gap_to_leader - prev_time_gap
                    if gap_to_leader is not None and prev_time_gap is not None
                    else None
                )
                prev_time_gap = gap_to_leader if gap_to_leader is not None else prev_time_gap

            est_catch = self._catch_time(interval, t, prev_row)

            in_world = t.track_surface is not None and t.track_surface >= 0
            is_class_leader = driver.car_class_id not in class_leader_seen
            if is_class_leader:
                class_leader_seen.add(driver.car_class_id)

            entries.append(
                StandingsEntry(
                    car_idx=t.car_idx,
                    position=t.position,
                    class_position=t.class_position,
                    car_class_id=driver.car_class_id,
                    lap=t.lap,
                    lap_dist_pct=t.lap_dist_pct,
                    last_lap_time=t.last_lap_time,
                    best_lap_time=t.best_lap_time,
                    gap_to_leader=gap_to_leader,
                    interval=interval,
                    gap_is_laps=gap_is_laps,
                    laps_down=laps_down,
                    gap_to_class_leader=None,  # filled in by _fill_class_relative
                    class_interval=None,
                    class_gap_is_laps=False,
                    interval_to_player=t.delta_to_player,
                    est_catch_time=est_catch,
                    positions_gained_total=self._gained_total(t.car_idx, t.position),
                    positions_gained_last_lap=self._last_lap_gained.get(t.car_idx, 0),
                    i_rating=driver.i_rating,
                    irating_change_est=ir_changes.get(t.car_idx, 0),
                    last_lap_status=self._lap_status(t),
                    sectors=[s.to_dict() for s in self._sectors.splits_for(t.car_idx)],
                    theoretical_best=self._sectors.theoretical_best_for(t.car_idx),
                    on_pit_road=t.on_pit_road,
                    track_surface_label=t.track_surface_label,
                    is_off_track=t.track_surface_label == "off_track",
                    is_in_pit_stall=t.track_surface_label == "in_pit_stall",
                    is_in_world=in_world,
                    is_retired=retired_by_idx.get(t.car_idx, False),
                    is_player=t.car_idx == session.driver_car_idx,
                    is_overall_leader=t is leader,
                    is_class_leader=is_class_leader,
                    is_lapped=gap_is_laps,
                    tire_compound=t.tire_compound,
                    tire_laps=tire_laps_by_idx.get(t.car_idx, 0),
                )
            )
            prev_row = t

        self._fill_class_relative(entries, timings)
        classes = self._group_classes(session.classes, entries, timings)
        n_sec = self._sectors.sector_count
        return StandingsSnapshot(
            entries=entries,
            classes=classes,
            player_car_idx=session.driver_car_idx,
            sector_count=n_sec,
            overall_best_lap=self._sectors.overall_best_lap,
            overall_best_lap_car_idx=self._sectors.overall_best_lap_car,
            overall_best_sectors=[self._sectors.overall_best.get(i) for i in range(n_sec)],
        )

    # -- helpers -------------------------------------------------------------
    def _gained_total(self, car_idx: int, position: int | None) -> int:
        start = self._start_pos.get(car_idx)
        if start is None or position is None:
            return 0
        return start - position

    def _lap_status(self, t: CarTiming) -> str:
        last = t.last_lap_time
        if last is None or last <= 0:
            return "none"
        best_lap = self._sectors.overall_best_lap
        if best_lap is not None and last <= best_lap + 1e-4:
            return "overall_best"
        if t.best_lap_time is not None and last <= t.best_lap_time + 1e-4:
            return "personal_best"
        return "normal"

    def _catch_time(
        self,
        interval: float | None,
        car: CarTiming,
        ahead: CarTiming | None,
    ) -> float | None:
        """Seconds for ``car`` to catch the car ``ahead`` at the current pace gap."""
        if (
            interval is None
            or interval <= 0
            or ahead is None
            or car.last_lap_time is None
            or ahead.last_lap_time is None
            or car.on_pit_road
            or ahead.on_pit_road
        ):
            return None
        closing = ahead.last_lap_time - car.last_lap_time  # >0 ⇒ car is faster
        if closing < _MIN_CLOSING_RATE:
            return None
        laps_to_catch = interval / closing
        return round(laps_to_catch * car.last_lap_time, 1)

    def _fill_class_relative(
        self,
        entries: list[StandingsEntry],
        timings: dict[int, CarTiming],
    ) -> None:
        """Second pass: gap to class leader + interval to the car ahead in class.

        ``entries`` is already in overall order, so the first car of each class we
        meet is that class's leader. Because ``F2Time`` is seconds behind the
        *overall* leader, the class-relative gap is simply the difference of two
        F2 times — no re-derivation needed.
        """
        leader_of: dict[int, StandingsEntry] = {}
        prev_of: dict[int, StandingsEntry] = {}
        for e in entries:
            cid = e.car_class_id
            leader = leader_of.get(cid)
            if leader is None:
                leader_of[cid] = e
                e.gap_to_class_leader = 0.0
                e.class_interval = 0.0
                prev_of[cid] = e
                continue

            laps_down = (
                max(0, (leader.lap or 0) - (e.lap or 0))
                if leader.lap is not None and e.lap is not None
                else 0
            )
            e.class_gap_is_laps = laps_down >= 1
            if e.class_gap_is_laps:
                e.gap_to_class_leader = float(laps_down)
                e.class_interval = None
            else:
                f2 = timings[e.car_idx].f2_time
                leader_f2 = timings[leader.car_idx].f2_time
                prev = prev_of[cid]
                prev_f2 = timings[prev.car_idx].f2_time
                e.gap_to_class_leader = (
                    f2 - leader_f2 if f2 is not None and leader_f2 is not None else None
                )
                e.class_interval = f2 - prev_f2 if f2 is not None and prev_f2 is not None else None
            prev_of[cid] = e

    def _group_classes(
        self,
        class_entries: list[ClassEntry],
        entries: list[StandingsEntry],
        timings: dict[int, CarTiming],
    ) -> list[ClassStanding]:
        """Build per-class groups in the session's class order (SOF desc)."""
        by_class: dict[int, list[StandingsEntry]] = {}
        for e in entries:
            by_class.setdefault(e.car_class_id, []).append(e)

        meta = {c.car_class_id: c for c in class_entries}
        # Preserve the session's class ordering, then any stragglers.
        ordered_ids = [c.car_class_id for c in class_entries if c.car_class_id in by_class]
        ordered_ids += [cid for cid in by_class if cid not in meta]

        out: list[ClassStanding] = []
        for cid in ordered_ids:
            members = by_class[cid]
            m = meta.get(cid)
            leader = members[0] if members else None
            fastest_car = None
            fastest_lap: float | None = None
            for e in members:
                best = e.best_lap_time
                if best is not None and best > 0 and (fastest_lap is None or best < fastest_lap):
                    fastest_lap = best
                    fastest_car = e.car_idx
            out.append(
                ClassStanding(
                    car_class_id=cid,
                    short_name=m.short_name if m else "",
                    color=m.color if m else "#ffffff",
                    sof=m.sof if m else 0,
                    car_count=len(members),
                    leader_car_idx=leader.car_idx if leader else None,
                    leader_lap=leader.lap if leader else None,
                    fastest_lap=fastest_lap,
                    fastest_lap_car_idx=fastest_car,
                    order=[e.car_idx for e in members],
                )
            )
        return out
