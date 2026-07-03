"""TelemetryLab bridge core.

Shared, source-agnostic building blocks for the iRacing bridge: the wire
protocol, normalized data models, session/CarIdx parsing, repositories, the
event bus, and the channel publisher — wired together by :class:`BridgeService`.

Both the real bridge (``bridge.py``, irsdk) and the mock (``mock_bridge.py``)
are thin *sources* plugged into this same machine, guaranteeing byte-identical
payloads across platforms.
"""

from __future__ import annotations

from .http_server import OverlayHTTPServer, maybe_start_http_server, resolve_web_root
from .protocol import PROTOCOL_VERSION, Channel
from .service import BridgeService, TelemetrySource

__all__ = [
    "PROTOCOL_VERSION",
    "Channel",
    "BridgeService",
    "TelemetrySource",
    "OverlayHTTPServer",
    "maybe_start_http_server",
    "resolve_web_root",
]
