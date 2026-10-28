"""Tests for resolving a driver's flair name to an ISO alpha-3 country code."""

from __future__ import annotations

import re
from collections import defaultdict
from pathlib import Path

import pytest

from telemetrylab.countries import _NAMES, _key, country_code

FRONTEND_TABLE = Path(__file__).resolve().parents[2] / "src" / "lib" / "countries.ts"


class TestCountryCode:
    @pytest.mark.parametrize(
        ("name", "expected"),
        [
            ("Spain", "ESP"),
            ("United Kingdom", "GBR"),
            ("United States", "USA"),
            ("Germany", "DEU"),
            ("Netherlands", "NLD"),
            ("Japan", "JPN"),
            ("Brazil", "BRA"),
        ],
    )
    def test_iso_short_names(self, name, expected):
        assert country_code(name) == expected

    @pytest.mark.parametrize(
        ("name", "expected"),
        [
            ("United States of America", "USA"),
            ("Great Britain", "GBR"),
            ("Russia", "RUS"),
            ("Russian Federation", "RUS"),
            ("South Korea", "KOR"),
            ("Korea, Republic of", "KOR"),
            ("North Korea", "PRK"),
            ("Czech Republic", "CZE"),
            ("Czechia", "CZE"),
            ("Turkey", "TUR"),
            ("Vietnam", "VNM"),
            ("Iran", "IRN"),
            ("Taiwan", "TWN"),
            ("Ivory Coast", "CIV"),
        ],
    )
    def test_everyday_names(self, name, expected):
        assert country_code(name) == expected

    @pytest.mark.parametrize(
        ("name", "expected"),
        [
            ("spain", "ESP"),
            ("  SPAIN  ", "ESP"),
            ("Türkiye", "TUR"),
            ("Turkiye", "TUR"),
            ("Côte d'Ivoire", "CIV"),
            ("Cote d’Ivoire", "CIV"),
            ("Curacao", "CUW"),
            ("The Netherlands", "NLD"),
            ("Bosnia & Herzegovina", "BIH"),
            ("St. Lucia", "LCA"),
            ("Guinea-Bissau", "GNB"),
        ],
    )
    def test_spelling_is_matched_loosely(self, name, expected):
        assert country_code(name) == expected

    @pytest.mark.parametrize("name", [None, "", "   ", "< No Flair >", "Atlantis"])
    def test_not_a_country_is_blank(self, name):
        assert country_code(name) == ""

    def test_each_name_belongs_to_one_country(self):
        owners = defaultdict(set)
        for code, names in _NAMES.items():
            for name in names:
                owners[_key(name)].add(code)
        assert {k: v for k, v in owners.items() if len(v) > 1} == {}

    def test_covers_every_flag_the_frontend_can_draw(self):
        # The frontend maps alpha-3 to its flag sprites. A code the bridge
        # sends that the table lacks draws no flag, and a country the table has
        # that the bridge cannot name never gets one.
        frontend = set(re.findall(r"\b([A-Z]{3}): \"[a-z]{2}\"", FRONTEND_TABLE.read_text()))
        assert set(_NAMES) == frontend
