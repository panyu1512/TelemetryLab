"""Tests for the car radar (:mod:`telemetrylab.radar`)."""

from __future__ import annotations

import pytest

from telemetrylab.enums import car_left_right
from telemetrylab.radar import (
    ALONGSIDE_M,
    HOLD_M,
    RANGE_M,
    RadarTracker,
    nearby_cars,
    wrap_gap,
)

TRACK_M = 5000.0

CLEAR, LEFT, RIGHT, LEFT_RIGHT, TWO_LEFT, TWO_RIGHT = 1, 2, 3, 4, 5, 6


def arrays(player_pct: float, gaps_m: dict[int, float], **extra) -> dict:
    """CarIdx arrays with the player at idx 0 and each other car ``gap`` metres up."""
    n = max([0, *gaps_m]) + 1
    pct = [-1.0] * n
    pct[0] = player_pct
    for idx, gap in gaps_m.items():
        pct[idx] = (player_pct + gap / TRACK_M) % 1.0
    out = {"CarIdxLapDistPct": pct, "CarIdxTrackSurface": [3] * n, "CarIdxOnPitRoad": [False] * n}
    out.update(extra)
    return out


def by_idx(frame) -> dict:
    return {c.car_idx: c for c in frame.cars}


class TestCarLeftRight:
    @pytest.mark.parametrize(
        "raw,label",
        [
            (0, "off"),
            (1, "clear"),
            (2, "car_left"),
            (3, "car_right"),
            (4, "car_left_right"),
            (5, "two_cars_left"),
            (6, "two_cars_right"),
            (None, "off"),
            (99, "off"),
        ],
    )
    def test_labels(self, raw, label):
        assert car_left_right(raw) == label


class TestWrapGap:
    def test_plain_difference(self):
        assert wrap_gap(0.30, 0.25) == pytest.approx(0.05)

    def test_across_the_line_ahead(self):
        # Player just short of the line, car just over it: a few metres ahead.
        assert wrap_gap(0.001, 0.999) == pytest.approx(0.002)

    def test_across_the_line_behind(self):
        assert wrap_gap(0.999, 0.001) == pytest.approx(-0.002)


class TestNearbyCars:
    def test_range_and_order(self):
        a = arrays(0.5, {1: -12.0, 2: 3.0, 3: RANGE_M + 5, 4: -RANGE_M - 1})
        assert [(i, round(g, 3)) for i, g in nearby_cars(a, 0, TRACK_M)] == [
            (2, 3.0),
            (1, -12.0),
        ]

    def test_skips_pits_garage_and_empty_slots(self):
        a = arrays(0.5, {1: 2.0, 2: -2.0, 3: 4.0, 5: 1.0})
        a["CarIdxTrackSurface"][1] = 1  # in pit stall
        a["CarIdxTrackSurface"][2] = -1  # not in world
        a["CarIdxOnPitRoad"][3] = True
        # idx 4 is an empty slot (pct -1).
        assert [i for i, _ in nearby_cars(a, 0, TRACK_M)] == [5]

    def test_off_track_car_still_counts(self):
        a = arrays(0.5, {1: 2.0})
        a["CarIdxTrackSurface"][1] = 0
        assert [i for i, _ in nearby_cars(a, 0, TRACK_M)] == [1]

    def test_no_player_position(self):
        a = arrays(0.5, {1: 2.0})
        a["CarIdxLapDistPct"][0] = -1.0
        assert nearby_cars(a, 0, TRACK_M) == []

    def test_missing_arrays(self):
        assert nearby_cars({}, 0, TRACK_M) == []
        assert nearby_cars(arrays(0.5, {1: 2.0}), 0, 0.0) == []

    def test_across_start_finish(self):
        a = arrays(0.9995, {1: 6.0})
        ((idx, gap),) = nearby_cars(a, 0, TRACK_M)
        assert idx == 1 and gap == pytest.approx(6.0, abs=1e-6)


class TestRadarTracker:
    def test_off_means_no_cars(self):
        frame = RadarTracker().update(0, arrays(0.5, {1: 1.0}), 0, TRACK_M)
        assert frame.state == "off"
        assert frame.cars == []
        assert (frame.left, frame.right) == (0, 0)

    def test_no_track_length_means_no_cars(self):
        frame = RadarTracker().update(LEFT, arrays(0.5, {1: 1.0}), 0, None)
        assert frame.state == "car_left"
        assert frame.left == 1
        assert frame.cars == []

    def test_clear_still_shows_traffic_without_sides(self):
        frame = RadarTracker().update(CLEAR, arrays(0.5, {1: -10.0, 2: 20.0}), 0, TRACK_M)
        cars = by_idx(frame)
        assert set(cars) == {1, 2}
        assert all(c.side is None and c.lane is None for c in frame.cars)

    def test_car_left_takes_the_nearest(self):
        frame = RadarTracker().update(LEFT, arrays(0.5, {1: -2.5, 2: -15.0}), 0, TRACK_M)
        cars = by_idx(frame)
        assert (cars[1].side, cars[1].lane) == ("left", 1)
        assert cars[1].gap_m == pytest.approx(-2.5)
        assert cars[2].side is None

    def test_spotter_call_without_a_close_enough_car(self):
        # The only car is beyond the alongside window: the side is lit by the
        # counts, but nothing is placed on it.
        frame = RadarTracker().update(RIGHT, arrays(0.5, {1: ALONGSIDE_M + 2}), 0, TRACK_M)
        assert frame.right == 1
        assert by_idx(frame)[1].side is None

    def test_two_cars_right_get_two_lanes(self):
        frame = RadarTracker().update(TWO_RIGHT, arrays(0.5, {1: 1.0, 2: -3.0}), 0, TRACK_M)
        cars = by_idx(frame)
        assert (cars[1].side, cars[1].lane) == ("right", 1)
        assert (cars[2].side, cars[2].lane) == ("right", 2)

    def test_sides_are_remembered_when_a_second_car_arrives(self):
        tracker = RadarTracker()
        # A car comes up the right...
        tracker.update(RIGHT, arrays(0.5, {1: -1.0, 2: -12.0}), 0, TRACK_M)
        # ...then a second, nearer one arrives on the left. Without memory the
        # nearer car would take "left" first and the cars would swap sides.
        frame = tracker.update(LEFT_RIGHT, arrays(0.5, {1: -2.0, 2: 0.5}), 0, TRACK_M)
        cars = by_idx(frame)
        assert cars[1].side == "right"
        assert cars[2].side == "left"

    def test_lane_next_to_you_is_kept(self):
        tracker = RadarTracker()
        tracker.update(LEFT, arrays(0.5, {1: -3.0, 2: -9.0}), 0, TRACK_M)
        frame = tracker.update(TWO_LEFT, arrays(0.5, {1: -3.0, 2: 0.2}), 0, TRACK_M)
        cars = by_idx(frame)
        assert (cars[1].side, cars[1].lane) == ("left", 1)
        assert (cars[2].side, cars[2].lane) == ("left", 2)

    def test_memory_gives_way_when_the_spotter_moves_a_car(self):
        tracker = RadarTracker()
        tracker.update(LEFT, arrays(0.5, {1: -1.0}), 0, TRACK_M)
        frame = tracker.update(RIGHT, arrays(0.5, {1: -1.0}), 0, TRACK_M)
        assert by_idx(frame)[1].side == "right"

    def test_memory_is_forgotten_once_a_car_leaves(self):
        tracker = RadarTracker()
        tracker.update(RIGHT, arrays(0.5, {1: -1.0}), 0, TRACK_M)
        tracker.update(CLEAR, arrays(0.5, {1: -20.0}), 0, TRACK_M)
        frame = tracker.update(LEFT_RIGHT, arrays(0.5, {1: 1.0, 2: -1.5}), 0, TRACK_M)
        # Neither car is remembered, so the nearer one takes left.
        assert by_idx(frame)[1].side == "left"
        assert by_idx(frame)[2].side == "right"

    def test_a_called_car_keeps_its_side_when_the_spotter_goes_quiet(self):
        # iRacing drops CarLeftRight to "clear" with the car still door to
        # door (off the throttle into a braking zone): the side stays lit.
        tracker = RadarTracker()
        tracker.update(LEFT, arrays(0.5, {1: -1.0}), 0, TRACK_M)
        frame = tracker.update(CLEAR, arrays(0.5, {1: 2.0}), 0, TRACK_M)
        assert frame.state == "clear"  # what the sim said, unchanged
        assert (frame.left, frame.right) == (1, 0)
        assert (by_idx(frame)[1].side, by_idx(frame)[1].lane) == ("left", 1)

    def test_the_hold_lasts_while_the_car_overlaps(self):
        tracker = RadarTracker()
        tracker.update(RIGHT, arrays(0.5, {1: -4.0}), 0, TRACK_M)
        for gap in (-3.0, -1.0, 1.0, 3.0, HOLD_M - 0.1):
            frame = tracker.update(CLEAR, arrays(0.5, {1: gap}), 0, TRACK_M)
            assert frame.right == 1, gap

    def test_the_hold_ends_once_the_car_has_gone(self):
        tracker = RadarTracker()
        tracker.update(LEFT, arrays(0.5, {1: -1.0}), 0, TRACK_M)
        frame = tracker.update(CLEAR, arrays(0.5, {1: HOLD_M + 0.5}), 0, TRACK_M)
        assert (frame.left, frame.right) == (0, 0)
        assert by_idx(frame)[1].side is None
        # Gone is gone: coming back alongside unannounced does not relight it.
        frame = tracker.update(CLEAR, arrays(0.5, {1: 1.0}), 0, TRACK_M)
        assert frame.left == 0

    def test_the_hold_ends_when_the_car_leaves_the_radar(self):
        tracker = RadarTracker()
        tracker.update(LEFT, arrays(0.5, {1: -1.0}), 0, TRACK_M)
        a = arrays(0.5, {1: -1.0})
        a["CarIdxOnPitRoad"][1] = True
        assert tracker.update(CLEAR, a, 0, TRACK_M).left == 0

    def test_a_car_the_spotter_never_called_gets_no_side(self):
        # Overlapping by lap distance, but which side is what the sim does
        # not publish: nothing lights.
        frame = RadarTracker().update(CLEAR, arrays(0.5, {1: 1.0}), 0, TRACK_M)
        assert (frame.left, frame.right) == (0, 0)
        assert by_idx(frame)[1].side is None

    def test_the_hold_survives_a_call_on_the_other_side(self):
        tracker = RadarTracker()
        tracker.update(LEFT, arrays(0.5, {1: -1.0}), 0, TRACK_M)
        # The spotter now calls only a new car on the right; the left car is
        # still beside you.
        frame = tracker.update(RIGHT, arrays(0.5, {1: -1.5, 2: 0.5}), 0, TRACK_M)
        cars = by_idx(frame)
        assert (frame.left, frame.right) == (1, 1)
        assert cars[1].side == "left"
        assert cars[2].side == "right"

    def test_a_side_the_spotter_calls_is_its_own(self):
        # Two cars were left; the spotter now counts one there. Its count
        # stands, and the car it no longer calls is not held beside it.
        tracker = RadarTracker()
        tracker.update(TWO_LEFT, arrays(0.5, {1: -1.0, 2: 0.5}), 0, TRACK_M)
        frame = tracker.update(LEFT, arrays(0.5, {1: -4.5, 2: 0.5}), 0, TRACK_M)
        assert frame.left == 1
        assert by_idx(frame)[1].side is None

    def test_two_held_cars_keep_their_lanes(self):
        tracker = RadarTracker()
        tracker.update(TWO_LEFT, arrays(0.5, {1: -1.0, 2: 0.5}), 0, TRACK_M)
        frame = tracker.update(CLEAR, arrays(0.5, {1: -1.2, 2: 0.4}), 0, TRACK_M)
        cars = by_idx(frame)
        assert frame.left == 2
        assert (cars[2].side, cars[2].lane) == ("left", 1)
        assert (cars[1].side, cars[1].lane) == ("left", 2)

    def test_off_drops_the_hold(self):
        tracker = RadarTracker()
        tracker.update(LEFT, arrays(0.5, {1: -1.0}), 0, TRACK_M)
        assert tracker.update(0, arrays(0.5, {1: -1.0}), 0, TRACK_M).left == 0
        assert tracker.update(CLEAR, arrays(0.5, {1: -1.0}), 0, TRACK_M).left == 0

    def test_reset_forgets(self):
        tracker = RadarTracker()
        tracker.update(RIGHT, arrays(0.5, {1: -1.0}), 0, TRACK_M)
        tracker.reset()
        frame = tracker.update(LEFT_RIGHT, arrays(0.5, {1: -1.0, 2: 0.5}), 0, TRACK_M)
        assert by_idx(frame)[2].side == "left"

    def test_wire_shape(self):
        frame = RadarTracker().update(LEFT, arrays(0.5, {1: -2.0}), 0, TRACK_M)
        assert frame.to_dict() == {
            "state": "car_left",
            "carLeftRight": LEFT,
            "left": 1,
            "right": 0,
            "rangeM": RANGE_M,
            "cars": [{"carIdx": 1, "gapM": -2.0, "side": "left", "lane": 1}],
        }

    def test_non_numeric_spotter_is_off(self):
        frame = RadarTracker().update("2", arrays(0.5, {1: -2.0}), 0, TRACK_M)
        assert frame.state == "off"
        assert frame.car_left_right is None
