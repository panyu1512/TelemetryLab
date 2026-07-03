"""Tests for the iRacing enum / bitmask decoders."""

from __future__ import annotations

import pytest

from telemetrylab.enums import (
    SESSION_FLAGS,
    decode_flags,
    session_state,
    track_surface,
)


class TestTrackSurface:
    @pytest.mark.parametrize(
        "value,expected",
        [
            (-1, "not_in_world"),
            (0, "off_track"),
            (1, "in_pit_stall"),
            (2, "approaching_pits"),
            (3, "on_track"),
        ],
    )
    def test_known_values(self, value, expected):
        assert track_surface(value) == expected

    def test_none_maps_to_not_in_world(self):
        # None is treated as -1 (not in world), not "unknown".
        assert track_surface(None) == "not_in_world"

    def test_unknown_value(self):
        assert track_surface(99) == "unknown"


class TestSessionState:
    @pytest.mark.parametrize(
        "value,expected",
        [
            (0, "invalid"),
            (1, "get_in_car"),
            (2, "warmup"),
            (3, "parade_laps"),
            (4, "racing"),
            (5, "checkered"),
            (6, "cool_down"),
        ],
    )
    def test_known_values(self, value, expected):
        assert session_state(value) == expected

    def test_none_maps_to_invalid(self):
        assert session_state(None) == "invalid"

    def test_unknown_value(self):
        assert session_state(42) == "unknown"


class TestDecodeFlags:
    def test_zero_is_empty(self):
        assert decode_flags(0) == []

    def test_none_is_empty(self):
        assert decode_flags(None) == []

    def test_single_flag(self):
        assert decode_flags(0x00000004) == ["green"]

    def test_multiple_flags_in_bit_order(self):
        # green (0x04) | yellow (0x08) | blue (0x20) — result follows table order.
        mask = 0x00000004 | 0x00000008 | 0x00000020
        assert decode_flags(mask) == ["green", "yellow", "blue"]

    def test_high_bit_start_go(self):
        # 0x80000000 must decode even though it sets the sign bit on 32-bit ints.
        assert "start_go" in decode_flags(0x80000000)

    def test_all_flags_decodable(self):
        # Every documented bit should appear when the full mask is set.
        full = 0
        for bit, _ in SESSION_FLAGS:
            full |= bit
        names = decode_flags(full)
        assert names == [name for _, name in SESSION_FLAGS]

    def test_unknown_bits_ignored(self):
        # A bit with no mapping contributes nothing.
        assert decode_flags(0x08000000) == []
