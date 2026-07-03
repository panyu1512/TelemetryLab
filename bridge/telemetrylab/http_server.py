"""Static HTTP server for browser / OBS overlay access.

The Tauri app serves the frontend over its internal ``tauri://localhost``
protocol, which is only reachable *inside* the app's own WebView — an external
browser or OBS Browser Source can't load it. This tiny static file server fills
that gap: it serves the built frontend (``dist/``) over plain HTTP on
``127.0.0.1:9999`` so ``http://127.0.0.1:9999/?overlay=standings`` works in any
browser and as an OBS Browser Source.

It runs in a daemon thread alongside the bridge's asyncio WebSocket server and
is deliberately dependency-free (stdlib ``http.server``). Client-side routing
(``?overlay=`` / ``?widget=``) means any unknown path falls back to
``index.html`` (SPA behaviour); real asset paths are served from disk with a
path-traversal guard.
"""

from __future__ import annotations

import mimetypes
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 9999


def _make_handler(web_root: Path) -> type[BaseHTTPRequestHandler]:
    index = web_root / "index.html"

    class Handler(BaseHTTPRequestHandler):
        # Quiet by default; the bridge owns logging.
        def log_message(self, *args: object) -> None:  # noqa: D401
            pass

        def _resolve(self, url_path: str) -> Path | None:
            # Drop query/fragment, decode, and normalise to a path under root.
            path = url_path.split("?", 1)[0].split("#", 1)[0]
            rel = unquote(path).lstrip("/")
            target = (web_root / rel).resolve()

            # Path-traversal guard: never serve outside the web root.
            if target != web_root and not target.is_relative_to(web_root):
                return None
            if target.is_dir():
                target = target / "index.html"
            if target.is_file():
                return target
            # SPA fallback: client-side routing handles the rest.
            return index if index.is_file() else None

        def _send(self, status: int, body: bytes, content_type: str) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            # Allow OBS / cross-origin browsers to fetch assets freely.
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)

        def do_GET(self) -> None:
            target = self._resolve(self.path)
            if target is None:
                self._send(404, b"Not Found", "text/plain; charset=utf-8")
                return
            content_type = mimetypes.guess_type(str(target))[0] or "application/octet-stream"
            self._send(200, target.read_bytes(), content_type)

        # HEAD shares the GET logic (BaseHTTPRequestHandler doesn't by default).
        do_HEAD = do_GET

    return Handler


class OverlayHTTPServer:
    """A threaded static file server rooted at the built frontend."""

    def __init__(
        self,
        web_root: str | os.PathLike[str],
        host: str = DEFAULT_HOST,
        port: int = DEFAULT_PORT,
    ) -> None:
        self.web_root = Path(web_root).resolve()
        self.host = host
        self.port = port
        self._httpd: ThreadingHTTPServer | None = None
        self._thread: threading.Thread | None = None

    def start(self) -> OverlayHTTPServer:
        handler = _make_handler(self.web_root)
        self._httpd = ThreadingHTTPServer((self.host, self.port), handler)
        # Reflect the actually-bound port (e.g. when port=0 in tests).
        self.port = self._httpd.server_address[1]
        self._thread = threading.Thread(
            target=self._httpd.serve_forever,
            name="overlay-http",
            daemon=True,
        )
        self._thread.start()
        return self

    def stop(self) -> None:
        if self._httpd is not None:
            self._httpd.shutdown()
            self._httpd.server_close()
            self._httpd = None
        if self._thread is not None:
            self._thread.join(timeout=2)
            self._thread = None

    @property
    def url(self) -> str:
        return f"http://{self.host}:{self.port}/"


def resolve_web_root() -> Path | None:
    """Find the built frontend directory, or ``None`` if it isn't available.

    Order: ``BRIDGE_HTTP_ROOT`` env → PyInstaller bundle (``_MEIPASS/dist``) →
    the repo's ``dist/`` (two levels up from this file). Returns ``None`` when
    nothing is found (e.g. the frontend hasn't been built yet).
    """
    override = os.environ.get("BRIDGE_HTTP_ROOT")
    candidates: list[Path] = []
    if override:
        candidates.append(Path(override))
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        candidates.append(Path(meipass) / "dist")
    # bridge/telemetrylab/http_server.py → repo root is two parents up.
    candidates.append(Path(__file__).resolve().parents[2] / "dist")

    for c in candidates:
        if (c / "index.html").is_file():
            return c.resolve()
    return None


def maybe_start_http_server() -> OverlayHTTPServer | None:
    """Start the overlay HTTP server from env config, or return ``None``.

    Disabled with ``BRIDGE_HTTP=0``. Host/port come from ``BRIDGE_HTTP_HOST`` /
    ``BRIDGE_HTTP_PORT``. Returns ``None`` (with a note) if disabled or if no
    built frontend is found.
    """
    if os.environ.get("BRIDGE_HTTP", "1") == "0":
        return None

    web_root = resolve_web_root()
    if web_root is None:
        print(
            "[http] overlay HTTP server not started: no built frontend found "
            "(run `npm run build`, or set BRIDGE_HTTP_ROOT).",
            flush=True,
        )
        return None

    host = os.environ.get("BRIDGE_HTTP_HOST", DEFAULT_HOST)
    port = int(os.environ.get("BRIDGE_HTTP_PORT", str(DEFAULT_PORT)) or DEFAULT_PORT)
    try:
        server = OverlayHTTPServer(web_root, host=host, port=port).start()
    except OSError as err:
        print(f"[http] overlay HTTP server failed to start on {host}:{port}: {err}", flush=True)
        return None

    print(f"[http] overlay HTTP server serving {web_root} at {server.url}", flush=True)
    return server
