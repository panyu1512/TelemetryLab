"""Integration tests for the overlay static HTTP server."""

from __future__ import annotations

import urllib.error
import urllib.request
from collections.abc import Iterator
from pathlib import Path

import pytest

from telemetrylab.http_server import (
    OverlayHTTPServer,
    maybe_start_http_server,
    resolve_web_root,
)


@pytest.fixture
def web_root(tmp_path: Path) -> Path:
    (tmp_path / "index.html").write_text("<!doctype html><title>overlay</title>")
    assets = tmp_path / "assets"
    assets.mkdir()
    (assets / "app.js").write_text("console.log('hi')")
    return tmp_path


@pytest.fixture
def server(web_root: Path) -> Iterator[OverlayHTTPServer]:
    srv = OverlayHTTPServer(web_root, host="127.0.0.1", port=0).start()
    try:
        yield srv
    finally:
        srv.stop()


# Bypass any HTTP(S)_PROXY in the environment — these requests are to localhost.
_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))


def _get(url: str) -> tuple[int, bytes, str]:
    with _OPENER.open(url, timeout=5) as resp:  # noqa: S310 (localhost)
        return resp.status, resp.read(), resp.headers.get("Content-Type", "")


def test_serves_index_at_root(server: OverlayHTTPServer) -> None:
    status, body, ctype = _get(server.url)
    assert status == 200
    assert b"overlay" in body
    assert "text/html" in ctype


def test_serves_static_asset(server: OverlayHTTPServer) -> None:
    status, body, ctype = _get(f"{server.url}assets/app.js")
    assert status == 200
    assert b"console.log" in body
    assert "javascript" in ctype


def test_spa_fallback_for_overlay_route(server: OverlayHTTPServer) -> None:
    # Client-side routing: an unknown path (with an ?overlay= query) still
    # resolves to index.html so the SPA can render the overlay.
    status, body, _ = _get(f"{server.url}overlays/standings?overlay=standings")
    assert status == 200
    assert b"overlay" in body


def test_cors_header_present(server: OverlayHTTPServer) -> None:
    with _OPENER.open(server.url, timeout=5) as resp:  # noqa: S310
        assert resp.headers.get("Access-Control-Allow-Origin") == "*"


def test_path_traversal_is_blocked(server: OverlayHTTPServer) -> None:
    # Escaping the web root must never leak files — a rejection (404) or an
    # index.html fallback are both fine, as long as no real file leaks.
    try:
        _status, body, _ = _get(f"{server.url}../../etc/passwd")
    except urllib.error.HTTPError as err:
        assert err.code in (400, 403, 404)
        return
    assert b"root:" not in body


def test_resolve_web_root_env_override(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    (tmp_path / "index.html").write_text("x")
    monkeypatch.setenv("BRIDGE_HTTP_ROOT", str(tmp_path))
    assert resolve_web_root() == tmp_path.resolve()


def test_resolve_web_root_missing(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BRIDGE_HTTP_ROOT", str(tmp_path / "nope"))
    # No index.html anywhere on the override path; may still be None.
    result = resolve_web_root()
    assert result is None or (result / "index.html").is_file()


def test_maybe_start_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("BRIDGE_HTTP", "0")
    assert maybe_start_http_server() is None
