"""iRacing enum mappings.

The SDK exposes many state fields as bare integers or bitmasks. We keep the raw
value on the wire (so the frontend can do its own thing and we never lose
information) but also attach a stable string label for readability and for
consumers that would rather switch on a name than memorise magic numbers.
"""

from __future__ import annotations

from typing import Final

# ---------------------------------------------------------------------------
# CarIdxTrackSurface / PlayerTrackSurface (irsdk_TrkLoc)
# ---------------------------------------------------------------------------
TRACK_SURFACE: Final[dict[int, str]] = {
    -1: "not_in_world",
    0: "off_track",
    1: "in_pit_stall",
    2: "approaching_pits",
    3: "on_track",
}


def track_surface(value: int | None) -> str:
    return TRACK_SURFACE.get(value if value is not None else -1, "unknown")


# ---------------------------------------------------------------------------
# SessionState (irsdk_SessionState)
# ---------------------------------------------------------------------------
SESSION_STATE: Final[dict[int, str]] = {
    0: "invalid",
    1: "get_in_car",
    2: "warmup",
    3: "parade_laps",
    4: "racing",
    5: "checkered",
    6: "cool_down",
}


def session_state(value: int | None) -> str:
    return SESSION_STATE.get(value if value is not None else 0, "unknown")


# ---------------------------------------------------------------------------
# SessionFlags (irsdk_Flags) — a bitmask. We decode it to a list of names so
# the frontend never has to know the bit layout.
# ---------------------------------------------------------------------------
SESSION_FLAGS: Final[list[tuple[int, str]]] = [
    (0x00000001, "checkered"),
    (0x00000002, "white"),
    (0x00000004, "green"),
    (0x00000008, "yellow"),
    (0x00000010, "red"),
    (0x00000020, "blue"),
    (0x00000040, "debris"),
    (0x00000080, "crossed"),
    (0x00000100, "yellow_waving"),
    (0x00000200, "one_lap_to_green"),
    (0x00000400, "green_held"),
    (0x00000800, "ten_to_go"),
    (0x00001000, "five_to_go"),
    (0x00002000, "random_waving"),
    (0x00004000, "caution"),
    (0x00008000, "caution_waving"),
    # Pit / driver-action flags (upper bits).
    (0x00010000, "black"),
    (0x00020000, "disqualify"),
    (0x00040000, "servicible"),
    (0x00080000, "furled"),
    (0x00100000, "repair"),
    (0x10000000, "start_hidden"),
    (0x20000000, "start_ready"),
    (0x40000000, "start_set"),
    (0x80000000, "start_go"),
]


def decode_flags(mask: int | None) -> list[str]:
    """Decode a SessionFlags bitmask into a list of active flag names."""
    if not mask:
        return []
    return [name for bit, name in SESSION_FLAGS if mask & bit]
