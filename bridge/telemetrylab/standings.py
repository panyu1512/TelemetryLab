"""Compute the field order and derived gaps — the standings channel.

This joins the static roster (:class:`DriverEntry`) with live timing
(:class:`CarTiming`) and derives the gap-to-leader / interval that the v0.4
standings screen renders. It is intentionally a **skeleton**: the ordering and
lapped-car handling are production-shaped, but sector deltas and the
lap-accurate gap reconstruction (from ``SplitTimeInfo`` + a lap-distance model)
land with the standings screen itself. The channel schema will not change when
that arrives — only the numbers get more precise.

Gap model
---------
- ``gap_to_leader`` prefers iRacing's own ``CarIdxF2Time`` (seconds behind the
  leader in a race), falling back to lap deltas when a car is lapped.
- ``interval`` is the delta to the car directly ahead in the order.
- When a car is one or more laps down, ``gap_is_laps`` flips and the value is a
  lap count, not seconds — the frontend renders "+1L" instead of "+"-style time.
"""

from __future__ import annotations

from typing import Optional

from .models import CarTiming, DriverEntry, StandingsEntry, StandingsSnapshot

_INF = float("inf")


def _sort_key(timing: CarTiming) -> tuple[float, float]:
    """Overall race order: by position, then by track progress as a tiebreak."""
    pos = timing.position if timing.position is not None else _INF
    progress = -(
        (timing.lap or 0) + (timing.lap_dist_pct or 0.0)
    )  # more progress = earlier
    return (pos, progress)


def compute_standings(
    drivers_by_idx: dict[int, DriverEntry],
    timings: dict[int, CarTiming],
    player_car_idx: int,
) -> StandingsSnapshot:
    """Order the field and derive gaps into a :class:`StandingsSnapshot`."""
    # Only race cars with a driver in the roster; skip pace/spectator slots.
    rows: list[CarTiming] = []
    for idx, timing in timings.items():
        driver = drivers_by_idx.get(idx)
        if driver is None or driver.is_pace_car or driver.is_spectator:
            continue
        rows.append(timing)

    rows.sort(key=_sort_key)

    leader = rows[0] if rows else None
    leader_lap = leader.lap if leader else None

    entries: list[StandingsEntry] = []
    prev_time_gap: Optional[float] = None
    for timing in rows:
        driver = drivers_by_idx[timing.car_idx]

        # Laps down relative to the leader.
        laps_down = 0
        if leader_lap is not None and timing.lap is not None:
            laps_down = max(0, leader_lap - timing.lap)

        gap_is_laps = laps_down >= 1
        if timing is leader:
            gap_to_leader: Optional[float] = 0.0
            interval: Optional[float] = 0.0
            prev_time_gap = 0.0
        elif gap_is_laps:
            gap_to_leader = float(laps_down)
            interval = None  # a lap-down interval is not a clean seconds value
        else:
            gap_to_leader = timing.f2_time
            interval = (
                gap_to_leader - prev_time_gap
                if gap_to_leader is not None and prev_time_gap is not None
                else None
            )
            prev_time_gap = gap_to_leader if gap_to_leader is not None else prev_time_gap

        entries.append(
            StandingsEntry(
                car_idx=timing.car_idx,
                position=timing.position,
                class_position=timing.class_position,
                car_class_id=driver.car_class_id,
                lap=timing.lap,
                lap_dist_pct=timing.lap_dist_pct,
                last_lap_time=timing.last_lap_time,
                best_lap_time=timing.best_lap_time,
                gap_to_leader=gap_to_leader,
                interval=interval,
                gap_is_laps=gap_is_laps,
                on_pit_road=timing.on_pit_road,
                track_surface_label=timing.track_surface_label,
                is_player=timing.car_idx == player_car_idx,
            )
        )

    return StandingsSnapshot(entries=entries, player_car_idx=player_car_idx)
