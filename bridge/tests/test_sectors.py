"""Tests for derived sector timing from lap-distance crossings."""

from __future__ import annotations

from telemetrylab.sectors import (
    CarSectorTracker,
    FieldSectorState,
    SectorSplit,
    parse_sector_starts,
)

# Three equal sectors for most tests.
THIRDS = [0.0, 1 / 3, 2 / 3]


class TestParseSectorStarts:
    def test_none_degrades_to_single_sector(self):
        assert parse_sector_starts(None) == [0.0]

    def test_parses_and_sorts(self):
        info = {
            "Sectors": [{"SectorStartPct": 0.66}, {"SectorStartPct": 0.0}, {"SectorStartPct": 0.33}]
        }
        assert parse_sector_starts(info) == [0.0, 0.33, 0.66]

    def test_prepends_zero_when_missing(self):
        info = {"Sectors": [{"SectorStartPct": 0.5}]}
        assert parse_sector_starts(info) == [0.0, 0.5]

    def test_filters_out_of_range(self):
        info = {
            "Sectors": [{"SectorStartPct": -0.1}, {"SectorStartPct": 1.5}, {"SectorStartPct": 0.5}]
        }
        assert parse_sector_starts(info) == [0.0, 0.5]

    def test_ignores_non_numeric(self):
        info = {"Sectors": [{"SectorStartPct": "x"}, {"SectorStartPct": 0.4}]}
        assert parse_sector_starts(info) == [0.0, 0.4]


class TestSectorSplitToDict:
    def test_delta_computed(self):
        s = SectorSplit(index=0, last_time=23.5, best_time=23.0, status="slower")
        d = s.to_dict()
        assert d["delta"] == 0.5
        assert d["lastTime"] == 23.5
        assert d["status"] == "slower"

    def test_delta_none_without_both_times(self):
        assert SectorSplit(index=0, last_time=23.5).to_dict()["delta"] is None


def _drive(tracker: CarSectorTracker, samples):
    """Feed (pct, lap, ts_ms) samples; return the list of completed indices."""
    completed = []
    for pct, lap, ts in samples:
        c = tracker.update(pct, lap, ts)
        if c is not None:
            completed.append(c)
    return completed


class TestCarSectorTracker:
    def test_first_sighting_records_nothing(self):
        t = CarSectorTracker(THIRDS)
        assert t.update(0.5, 1, 0) is None
        assert t.last == {}

    def test_clean_sector_completes_and_times(self):
        t = CarSectorTracker(THIRDS)
        # Enter S0 at its start (0.0), cross into S1 one second later.
        assert t.update(0.0, 1, 0) is None  # first sighting, arms S0 (unclean)
        # Because the first sighting is unclean, the first completed sector is
        # not timed — drive a full clean lap to get a real split.
        completed = _drive(
            t,
            [
                (0.34, 1, 1000),  # cross into S1 — S0 was unclean, no time
                (0.67, 1, 2000),  # cross into S2 — S1 entered cleanly, 1.0s
            ],
        )
        assert completed == [1]
        assert t.last[1] == 1.0

    def test_personal_best_tracked(self):
        t = CarSectorTracker(THIRDS)
        _drive(
            t,
            [
                (0.0, 1, 0),
                (0.34, 1, 1000),
                (0.67, 1, 2500),  # S1 = 1.5s (clean)
                (0.01, 2, 3500),  # wrap into S0, S2 timed = 1.0s
                (0.34, 2, 4000),  # S0 timed = 0.5s
                (0.67, 2, 4800),  # S1 = 0.8s — new personal best for S1
            ],
        )
        assert t.best[1] == 0.8

    def test_backward_jump_abandons_flight(self):
        t = CarSectorTracker(THIRDS)
        # Mid-sector teleport backwards (spin/tow) that is not a lap wrap.
        completed = _drive(
            t,
            [
                (0.30, 1, 0),
                (0.34, 1, 500),  # clean into S1
                (0.10, 1, 1000),  # big backward jump, same lap → abandon
                (0.34, 1, 1500),  # re-enter S1
                (0.67, 1, 2000),  # S1 timed cleanly = 0.5s
            ],
        )
        assert completed == [1]
        assert t.last[1] == 0.5

    def test_theoretical_best_needs_all_sectors(self):
        t = CarSectorTracker(THIRDS)
        assert t.theoretical_best() is None
        _drive(
            t,
            [
                (0.0, 1, 0),
                (0.34, 1, 1000),  # S0 unclean
                (0.67, 1, 2000),  # S1 = 1.0
                (0.01, 2, 3000),  # S2 = 1.0
                (0.34, 2, 4000),  # S0 = 1.0
            ],
        )
        # Now all three sectors have a best.
        assert t.theoretical_best() == 3.0

    def test_no_sectors_is_noop(self):
        t = CarSectorTracker([])
        assert t.update(0.5, 1, 0) is None

    def test_none_pct_ignored(self):
        t = CarSectorTracker(THIRDS)
        assert t.update(None, 1, 0) is None


class TestFieldSectorState:
    def _lap(self, field, car, ts0, *, lap, last_lap_time=None):
        """Drive one clean lap of thirds for a car starting at ts0 (ms)."""
        field.observe(car, 0.0, lap, last_lap_time, ts0)
        field.observe(car, 0.34, lap, last_lap_time, ts0 + 1000)
        field.observe(car, 0.67, lap, last_lap_time, ts0 + 2000)
        field.observe(car, 0.01, lap + 1, last_lap_time, ts0 + 3000)

    def test_overall_best_across_field(self):
        f = FieldSectorState(THIRDS)
        # Car 0 runs S1 in 1.0s; car 1 runs S1 in 0.8s.
        f.observe(0, 0.0, 1, None, 0)
        f.observe(0, 0.34, 1, None, 1000)
        f.observe(0, 0.67, 1, None, 2000)  # S1 = 1.0
        f.observe(1, 0.0, 1, None, 0)
        f.observe(1, 0.34, 1, None, 1000)
        f.observe(1, 0.67, 1, None, 1800)  # S1 = 0.8
        assert f.overall_best[1] == 0.8

    def test_overall_best_lap_from_sim_value(self):
        f = FieldSectorState(THIRDS)
        f.observe(0, 0.5, 1, 95.0, 0)
        f.observe(1, 0.5, 1, 92.3, 0)
        f.observe(0, 0.6, 1, 94.0, 100)
        assert f.overall_best_lap == 92.3
        assert f.overall_best_lap_car == 1

    def test_grade_overall_best_is_purple(self):
        f = FieldSectorState(THIRDS)
        self._lap(f, 0, 0, lap=1)  # S1 timed = 1.0, becomes overall + personal best
        splits = f.splits_for(0)
        assert splits[1].status == "overall_best"

    def test_grade_personal_best_green(self):
        f = FieldSectorState(THIRDS)
        # Car 1 sets the field best for S1 (0.5s).
        f.observe(1, 0.0, 1, None, 0)
        f.observe(1, 0.34, 1, None, 1000)
        f.observe(1, 0.67, 1, None, 1500)  # S1 = 0.5 overall best
        # Car 0 runs S1 in 1.0s = its personal best but slower than overall.
        self._lap(f, 0, 10_000, lap=1)
        status = f.splits_for(0)[1].status
        assert status == "personal_best"

    def test_grade_much_slower_red(self):
        f = FieldSectorState(THIRDS)
        # Establish car 0's personal best for S1 at 0.5s.
        f.observe(0, 0.0, 1, None, 0)
        f.observe(0, 0.34, 1, None, 1000)
        f.observe(0, 0.67, 1, None, 1500)  # S1 = 0.5 (PB)
        f.observe(0, 0.01, 2, None, 2000)  # S2
        f.observe(0, 0.34, 2, None, 3000)  # S0
        # Next S1 is 2.0s — more than 0.75 over the 0.5 PB → much_slower.
        f.observe(0, 0.67, 2, None, 5000)  # S1 = 2.0
        assert f.splits_for(0)[1].status == "much_slower"

    def test_splits_for_unknown_car_are_empty(self):
        f = FieldSectorState(THIRDS)
        splits = f.splits_for(99)
        assert len(splits) == 3
        assert all(s.status == "none" for s in splits)

    def test_retune_clears_state(self):
        f = FieldSectorState(THIRDS)
        f.observe(0, 0.5, 1, 92.0, 0)
        f.retune([0.0, 0.5])
        assert f.sector_count == 2
        assert f.overall_best_lap is None
        assert f.overall_best == {}

    def test_retune_noop_when_same(self):
        f = FieldSectorState(THIRDS)
        f.observe(0, 0.5, 1, 92.0, 0)
        f.retune(THIRDS)  # identical — must not wipe state
        assert f.overall_best_lap == 92.0
