"""The synthetic track the coach is tested against must itself be trustworthy:
every mistake has to cost time, laps must be repeatable, and the driver's clock
has to agree with its lap times."""

from __future__ import annotations

import pytest

from telemetrylab import mocktrack as mt


@pytest.fixture(scope="module")
def clean() -> mt.MockLap:
    return mt.drive_lap()


class TestDriveLap:
    def test_clean_lap_is_a_plausible_gt3_lap_of_spa(self, clean):
        assert 130.0 < clean.lap_time < 140.0
        assert clean.metres == round(mt.TRACK_LENGTH_M)
        assert max(clean.speed) <= mt.V_MAX
        # Every apex is taken at its corner's speed.
        for c in mt.CORNERS:
            d = round(c.apex_pct * mt.TRACK_LENGTH_M)
            assert clean.speed[d] == pytest.approx(c.apex_kmh, abs=0.5)

    def test_is_deterministic(self, clean):
        assert mt.drive_lap().t == clean.t

    @pytest.mark.parametrize(
        "mistake",
        [
            mt.Mistake(brake_early_m=15),
            mt.Mistake(coast_m=120),
            mt.Mistake(apex_slow_kmh=8),
            mt.Mistake(brake_late_m=12, apex_slow_kmh=6),
            mt.Mistake(throttle_late_m=30),
        ],
    )
    def test_every_mistake_costs_time(self, clean, mistake):
        assert mt.drive_lap({1: mistake}).lap_time > clean.lap_time + 0.01

    def test_pedals_agree_with_the_speed_trace(self, clean):
        apex = round(mt.CORNERS[0].apex_pct * mt.TRACK_LENGTH_M)
        assert clean.brake[apex - 20] > 0.5 and clean.throttle[apex - 20] == 0.0
        assert clean.throttle[apex + 20] == 1.0 and clean.brake[apex + 20] == 0.0

    def test_early_brake_holds_partial_throttle_at_apex_speed(self):
        lap = mt.drive_lap({1: mt.Mistake(brake_early_m=20)})
        apex = round(mt.CORNERS[1].apex_pct * mt.TRACK_LENGTH_M)
        assert lap.throttle[apex - 10] == mt.HOLD_THROTTLE
        assert lap.speed[apex - 10] == pytest.approx(mt.CORNERS[1].apex_kmh)

    def test_coast_rolls_off_both_pedals(self):
        lap = mt.drive_lap({2: mt.Mistake(coast_m=120)})
        coasting = [d for d in range(lap.metres) if lap.throttle[d] == 0.0 and lap.brake[d] == 0.0]
        assert len(coasting) > 60

    def test_at_time_interpolates_and_clamps(self, clean):
        assert clean.at_time(-5)["pct"] == 0.0
        assert clean.at_time(clean.lap_time + 5)["pct"] == pytest.approx(1.0)
        mid = clean.at_time(clean.lap_time / 2)
        assert 0.0 < mid["pct"] < 1.0

    def test_gear_bands(self):
        assert mt.gear_for(40) == 1
        assert mt.gear_for(150) == 4
        assert mt.gear_for(250) == 6


class TestMockDriver:
    def test_mistakes_are_repeatable_and_rivage_is_the_weak_spot(self):
        assert mt.mistakes_for_lap(5) == mt.mistakes_for_lap(5)
        early_at_rivage = sum(
            1 for k in range(40) if mt.mistakes_for_lap(k).get(2, mt.CLEAN).brake_early_m > 0
        )
        assert early_at_rivage > 20

    def test_starts_near_the_line_and_laps_are_contiguous(self):
        d = mt.MockDriver(start_pct=0.9)
        s = d.state(0.0)
        assert s["lap"] == 0 and s["pct"] == pytest.approx(0.9, abs=0.001)
        boundary = d.lap(0).lap_time - d.lap(0).t[int(0.9 * d.lap(0).metres)]
        assert d.lap_at(boundary - 0.01) == 0
        assert d.lap_at(boundary + 0.01) == 1
        assert d.state(boundary + 0.01)["pct"] < 0.01

    def test_last_and_best_lap(self):
        d = mt.MockDriver()
        assert d.last_lap_time(1.0) is None and d.best_lap_time(1.0) is None
        t = 3 * 140.0
        k = d.lap_at(t)
        assert d.last_lap_time(t) == d.lap(k - 1).lap_time
        assert d.best_lap_time(t) == min(d.lap(i).lap_time for i in range(1, k))
