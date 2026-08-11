"""Tests for session-info parsing: SOF, roster, colors, and assembly."""

from __future__ import annotations

import math

import pytest

from telemetrylab.parsing import (
    _car_make,
    _hex_color,
    _int,
    _is_unlimited,
    _license_group,
    _num,
    parse_drivers,
    parse_session_info,
    strength_of_field,
)

from .conftest import make_driver, make_session_raw


class TestCoercers:
    @pytest.mark.parametrize("value", [None, "", "unlimited", "UNLIMITED", "  Unlimited  "])
    def test_is_unlimited_true(self, value):
        assert _is_unlimited(value) is True

    @pytest.mark.parametrize("value", [0, "0", "20", "60.0"])
    def test_is_unlimited_false(self, value):
        assert _is_unlimited(value) is False

    def test_num_from_int_and_float(self):
        assert _num(5) == 5.0
        assert _num(2.5) == 2.5

    def test_num_from_string_with_units(self):
        assert _num("4.65 km") == 4.65
        assert _num("-3.2 sec") == -3.2

    def test_num_from_garbage_is_none(self):
        assert _num("n/a") is None
        assert _num(None) is None
        assert _num([1, 2]) is None

    def test_int_with_default(self):
        assert _int(None, 7) == 7
        assert _int("12 laps") == 12
        assert _int("no number", 3) == 3


class TestHexColor:
    def test_int_color(self):
        assert _hex_color(0x00FF88) == "#00ff88"

    def test_masks_to_24_bits(self):
        assert _hex_color(0xFF00FF88) == "#00ff88"

    def test_string_0x_prefix(self):
        assert _hex_color("0x1a2b3c") == "#1a2b3c"

    def test_string_hash_prefix(self):
        assert _hex_color("#AABBCC") == "#aabbcc"

    def test_none_defaults_white(self):
        assert _hex_color(None) == "#ffffff"

    def test_invalid_defaults_white(self):
        assert _hex_color("not-a-color") == "#ffffff"


class TestLicenseGroup:
    @pytest.mark.parametrize(
        "lic,expected",
        [
            ("A 3.45", "A"),
            ("B 2.10", "B"),
            ("R 0.00", "R"),
            ("Pro 5.00", "P"),
            ("", "R"),
        ],
    )
    def test_group(self, lic, expected):
        assert _license_group(lic) == expected


class TestCarMake:
    def test_first_word(self):
        assert _car_make("Audi R8 LMS EVO II") == "Audi"

    def test_empty(self):
        assert _car_make("") == ""


class TestStrengthOfField:
    def test_empty_is_zero(self):
        assert strength_of_field([]) == 0

    def test_all_invalid_is_zero(self):
        assert strength_of_field([0, -100, None]) == 0

    def test_uniform_field_equals_that_rating(self):
        # A field where everyone has the same iRating has an SOF at that rating.
        assert strength_of_field([2000, 2000, 2000, 2000]) == 2000

    def test_matches_bradley_terry_model(self):
        iratings = [1500, 2500, 3500]
        b = 1600.0 / math.log(2.0)
        denom = sum(math.exp(-ir / b) for ir in iratings)
        expected = int(round(b * math.log(len(iratings) / denom)))
        assert strength_of_field(iratings) == expected

    def test_ignores_zero_and_negative(self):
        # Filtering out invalids means SOF equals the SOF of the valid subset.
        assert strength_of_field([2000, 0, 2000, -5]) == strength_of_field([2000, 2000])


class TestParseDrivers:
    def test_skips_negative_car_idx(self):
        drivers = parse_drivers({"Drivers": [make_driver(-1)]}, "road")
        assert drivers == []

    def test_empty_driver_info(self):
        assert parse_drivers({}, "road") == []

    def test_basic_fields(self):
        d = parse_drivers({"Drivers": [make_driver(3, user_name="Alonso")]}, "road")[0]
        assert d.car_idx == 3
        assert d.user_name == "Alonso"
        assert d.license_category == "road"
        assert d.car_make == "Audi"

    def test_safety_rating_scaled(self):
        d = parse_drivers({"Drivers": [make_driver(0, lic_sublevel=345)]}, "road")[0]
        assert d.safety_rating == 3.45

    def test_car_number_strips_quotes(self):
        d = parse_drivers({"Drivers": [make_driver(0, car_number='"07"')]}, "road")[0]
        assert d.car_number == "07"

    def test_pace_car_flag_from_pace_car_idx(self):
        info = {"Drivers": [make_driver(0)], "PaceCarIdx": 0}
        d = parse_drivers(info, "road")[0]
        assert d.is_pace_car is True

    def test_team_driver_detected(self):
        d = parse_drivers({"Drivers": [make_driver(0, team_id=99)]}, "road")[0]
        assert d.is_team_driver is True


class TestParseSessionInfo:
    def test_minimal_defaults(self):
        session = parse_session_info({})
        assert session.session_num == 0
        assert session.drivers == []
        assert session.classes == []
        assert session.track.track_id == 0

    def test_track_and_category(self):
        session = parse_session_info(make_session_raw())
        assert session.track.name == "Circuit de Barcelona-Catalunya"
        assert session.track.length_km == 4.65
        assert session.category == "road"

    def test_lap_limited_race(self):
        session = parse_session_info(make_session_raw())
        assert session.session_laps_total == 20
        assert session.is_timed is False

    def test_timed_race(self):
        raw = make_session_raw(
            sessions=[{"SessionType": "Race", "SessionTime": "3600.0", "SessionLaps": "unlimited"}]
        )
        session = parse_session_info(raw)
        assert session.session_time_total == 3600.0
        assert session.session_laps_total is None
        assert session.is_timed is True

    def test_laps_remain_sentinel_is_none(self):
        # 32767 is iRacing's "unlimited/not applicable" sentinel.
        raw = make_session_raw(session_laps_remain=32767)
        assert parse_session_info(raw).session_laps_remain is None

    def test_prefers_the_ex_channel(self):
        # In a timed race the plain channel is the sentinel and `…Ex` carries
        # iRacing's own predicted lap count — the number AutoFuel fuels against.
        raw = make_session_raw(session_laps_remain=32767, session_laps_remain_ex=14)
        assert parse_session_info(raw).session_laps_remain == 14

    def test_ex_wins_over_a_valid_plain_value(self):
        raw = make_session_raw(session_laps_remain=20, session_laps_remain_ex=18)
        assert parse_session_info(raw).session_laps_remain == 18

    def test_falls_back_when_ex_is_the_sentinel(self):
        raw = make_session_raw(session_laps_remain=20, session_laps_remain_ex=32767)
        assert parse_session_info(raw).session_laps_remain == 20

    def test_falls_back_when_ex_is_absent(self):
        # An older SDK, or a session that has not started.
        raw = make_session_raw(session_laps_remain=7)
        assert parse_session_info(raw).session_laps_remain == 7

    def test_both_sentinel_is_none(self):
        raw = make_session_raw(session_laps_remain=32767, session_laps_remain_ex=32767)
        assert parse_session_info(raw).session_laps_remain is None

    def test_negative_laps_are_not_a_count(self):
        # Shows up between sessions; it is not "minus two laps to go".
        raw = make_session_raw(session_laps_remain=20, session_laps_remain_ex=-2)
        assert parse_session_info(raw).session_laps_remain == 20

    def test_session_id_composition(self):
        raw = make_session_raw(session_num=2, sessions=[{}, {}, {"SessionType": "Race"}])
        session = parse_session_info(raw)
        # subsession:trackId:sessionNum
        assert session.session_id == "555:42:2"

    def test_session_num_out_of_range_falls_back_to_last(self):
        raw = make_session_raw(
            session_num=9, sessions=[{"SessionType": "Practice"}, {"SessionType": "Race"}]
        )
        session = parse_session_info(raw)
        assert session.session_type == "Race"

    def test_classes_built_and_sorted_by_sof(self):
        drivers = [
            make_driver(0, car_class_id=1, car_class_short_name="GT3", i_rating=2000),
            make_driver(1, car_class_id=1, car_class_short_name="GT3", i_rating=2000),
            make_driver(2, car_class_id=2, car_class_short_name="GT4", i_rating=4000),
        ]
        session = parse_session_info(make_session_raw(drivers=drivers))
        assert len(session.classes) == 2
        # Strongest class (GT4, higher iR) first.
        assert session.classes[0].short_name == "GT4"
        assert session.classes[0].car_count == 1

    def test_pace_and_spectator_excluded_from_classes(self):
        drivers = [
            make_driver(0, car_class_id=1),
            make_driver(1, car_class_id=1, is_pace_car=True),
            make_driver(2, car_class_id=1, is_spectator=True),
        ]
        session = parse_session_info(make_session_raw(drivers=drivers))
        assert session.classes[0].car_count == 1

    def test_flags_decoded(self):
        raw = make_session_raw(session_flags=0x00000004)  # green
        assert parse_session_info(raw).flags == ["green"]

    def test_weather_prefers_realtime_over_weekend(self):
        raw = make_session_raw(air_temp=25.5, track_temp=38.0)
        session = parse_session_info(raw)
        assert session.weather.air_temp == 25.5
        assert session.weather.track_temp == 38.0

    def test_driver_car_idx_from_player_car_idx_fallback(self):
        raw = make_session_raw()
        raw["driver_info"].pop("DriverCarIdx")
        raw["player_car_idx"] = 4
        assert parse_session_info(raw).driver_car_idx == 4
